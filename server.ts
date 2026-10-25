import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load .env for the Node process (tsx/dev + prod) so GEMINI_API_KEY / WOLFRAM_APPID work
function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Fallback manual parser
    try {
      const raw = fs.readFileSync(envPath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const key = match[1];
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch (parseErr) {
      console.warn("Could not parse .env file:", parseErr);
    }
  }
}

loadEnvFile();

/**
 * The single Gemini model used across every AI endpoint.
 * Override with GEMINI_MODEL in .env if you ever need to change it.
 */
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();

function getGeminiApiKey(): string | undefined {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim();
  return key || undefined;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 32mb: the Puskice endpoint receives base64 PDFs / image batches
  app.use(express.json({ limit: "32mb" }));

  // Lazy Gemini client helper
  let genAIClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY nije podeĹˇen. Dodaj GEMINI_API_KEY (ili VITE_GEMINI_API_KEY) u .env fajl i restartuj server."
      );
    }
    if (!genAIClient) {
      genAIClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
          // Per-call timeout so a stuck request can't hang the endpoint forever.
          timeout: 30_000,
          // Disable the SDK's own internal retries (default: 5 attempts with up
          // to 60s backoff each). generateWithRetry below already handles
          // retries with a bounded delay, so nested retries only multiply latency.
          retryOptions: { attempts: 1 },
        },
      });
    }
    return genAIClient;
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      model: GEMINI_MODEL,
      hasGeminiKey: Boolean(getGeminiApiKey()),
      hasWolframKey: Boolean(process.env.WOLFRAM_APPID?.trim()),
    });
  });

  // ------------------------------------------------------------------
  // Gemini call helper with automatic retry on transient failures
  // (503 UNAVAILABLE / high demand, 429 rate limit, 500, timeouts).
  //
  // Resilience model:
  //   1. Retry the primary model (GEMINI_MODEL) with exponential backoff.
  //   2. If it keeps failing (or its daily free-tier quota is exhausted),
  //      move on to the next model in GEMINI_MODEL_CHAIN so the app keeps
  //      working instead of falling back to canned answers.
  //   3. Respect a total time budget so a single request can't hang forever.
  // ------------------------------------------------------------------
  const GEMINI_MAX_ATTEMPTS = 3;
  const GEMINI_RETRY_DELAY_MS = 1200;
  const GEMINI_TOTAL_BUDGET_MS = 75_000;

  /** Tried in order after the configured GEMINI_MODEL (skip duplicates). */
  const GEMINI_MODEL_CHAIN = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
  ];

  /**
   * model -> epoch ms until which that model reports an exhausted daily quota.
   * Lets us skip a model we know has no quota left instead of burning retries.
   */
  const geminiQuotaCooldown = new Map<string, number>();

  function isTransientGeminiError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
    return (
      msg.includes("unavailable") ||
      msg.includes("503") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("internal error") ||
      msg.includes("500") ||
      msg.includes("deadline") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("fetch failed")
    );
  }

  /**
   * If Gemini reports an exhausted DAILY quota with a "retry in 15h48m" /
   * "retryDelay":"56896s" hint, return the epoch ms when it resets (null if
   * the error carries no such hint).
   */
  function readQuotaResetAt(err: unknown): number | null {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const hms = msg.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
    if (hms) {
      const secs =
        Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0);
      if (secs > 0) return Date.now() + secs * 1000;
    }
    const delay = msg.match(/"retryDelay"\s*:\s*"?(\d+(?:\.\d+)?)s/i);
    if (delay && Number(delay[1]) > 0) {
      return Date.now() + Number(delay[1]) * 1000;
    }
    return null;
  }

  /** Model priority order: primary first, cooled-down models pushed to the back. */
  function geminiModelChain(preferred?: string): string[] {
    const primary = (preferred || GEMINI_MODEL).trim();
    const chain: string[] = [];
    for (const m of [primary, ...GEMINI_MODEL_CHAIN]) {
      if (m && !chain.includes(m)) chain.push(m);
    }
    const now = Date.now();
    const ready = chain.filter((m) => (geminiQuotaCooldown.get(m) || 0) <= now);
    const cooling = chain.filter((m) => (geminiQuotaCooldown.get(m) || 0) > now);
    // If everything is cooling down, still try — a real answer beats a canned one.
    return ready.length > 0 ? [...ready, ...cooling] : chain;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  interface GeminiRequest {
    model?: string;
    contents: unknown;
    systemInstruction?: string;
    /** Ask Gemini to answer with raw JSON (used by the classroom endpoints). */
    responseMimeType?: string;
  }

  /** Calls Gemini, retrying transient errors and falling back across models. */
  async function generateWithRetry(req: GeminiRequest): Promise<string> {
    const startedAt = Date.now();
    const chain = geminiModelChain(req.model);
    let lastErr: unknown = null;
    let outOfTime = false;

    outer: for (const modelName of chain) {
      for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
        if (Date.now() - startedAt > GEMINI_TOTAL_BUDGET_MS) {
          outOfTime = true;
          break outer;
        }

        try {
          const client = getGeminiClient();
          const config: Record<string, unknown> = {};
          if (req.systemInstruction) config.systemInstruction = req.systemInstruction;
          if (req.responseMimeType) config.responseMimeType = req.responseMimeType;

          const response = await client.models.generateContent({
            model: modelName,
            contents: req.contents as never,
            config: config as never,
          });
          const text = (response.text || "").trim();
          if (text) {
            if (modelName !== chain[0]) {
              console.warn(`Gemini answered via fallback model: ${modelName}`);
            }
            return text;
          }
          lastErr = new Error("Model je vratio prazan odgovor.");
        } catch (err: unknown) {
          lastErr = err;
          const message = err instanceof Error ? err.message : String(err ?? "");

          // Daily quota gone for this model — don't waste retries on it.
          const quotaResetAt = readQuotaResetAt(err);
          if (quotaResetAt) {
            geminiQuotaCooldown.set(modelName, quotaResetAt);
            console.warn(
              `Gemini ${modelName}: daily quota exhausted until ${new Date(
                quotaResetAt
              ).toLocaleTimeString()}, switching to next model.`
            );
            break;
          }

          const transient = isTransientGeminiError(err);
          console.warn(
            `Gemini attempt ${attempt}/${GEMINI_MAX_ATTEMPTS} (${modelName}) failed${transient ? " (transient)" : ""}:`,
            message
          );
          // Non-transient (bad key, 404 model...) — try the next model instead.
          if (!transient) break;
          if (attempt < GEMINI_MAX_ATTEMPTS) {
            const backoff =
              GEMINI_RETRY_DELAY_MS * Math.pow(2, attempt - 1) +
              Math.floor(Math.random() * 500);
            await sleep(backoff);
          }
        }
      }
    }

    if (outOfTime && lastErr instanceof Error) {
      throw new Error(`Gemini: vreme za odgovor je isteklo (${lastErr.message})`);
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Gemini model nije vratio odgovor.");
  }

  // ------------------------------------------------------------------
  // Wolfram Alpha: exact formulas, computations and final answers
  // Requires WOLFRAM_APPID in .env (free key from developer.wolframalpha.com)
  // ------------------------------------------------------------------
  function getWolframAppId(): string {
    return (
      process.env.WOLFRAM_APPID?.trim() ||
      process.env.WOLFRAM_API_KEY?.trim() ||
      ""
    );
  }

  const WOLFRAM_HINTS = [
    "izvod", "izvodi", "izraÄŤunaj", "izracunaj", "raÄŤunaj", "racunaj",
    "reĹˇi", "resi", "jednaÄŤin", "jednacin", "_integral", "integral",
    "derivacij", "graniÄŤna", "granicna", "limes", "logarit", "logaritm",
    "matric", "determinant", "verovatnoÄ‡", "verovatnoc", "procent", "koliko je",
    "calculate", "compute", "solve", "equation", "derivative", "limit",
    "what is", "how much", "simplify", "factor", "expand", "wolfram",
  ];

  function looksLikeComputation(text: string): boolean {
    const lower = text.toLowerCase();
    if (WOLFRAM_HINTS.some((hint) => lower.includes(hint.replace(/^_/, "")))) {
      return true;
    }
    // digits glued to math operators, powers, roots or an equals sign
    return /[0-9]\s*[+\-*/^=]/.test(text) || /[√∫∑π²³]/.test(text);
  }

  interface WolframPod {
    title: string;
    text: string;
  }

  interface WolframResult {
    input: string;
    pods: WolframPod[];
    answer?: string;
  }

  // Serbian/Croatian/Bosnian -> English math vocabulary so Wolfram understands.
  // Order matters: multi-word phrases first.
  const WOLFRAM_TRANSLATIONS: Array<[RegExp, string]> = [
    // question words
    [/koliko\s+je/gi, "what is"],
    [/koliko/gi, "how much"],
    [/\bod\b/gi, "of"],
    [/\bza\b/gi, "for"],
    [/\bkada\b|\bkad\b/gi, "when"],
    [/te[zž]i\b|tezi\b/gi, "tends"],
    // commands
    [/izra[cč]unaj\w*|izra[cč]unati|ra[cč]unaj\w*|racunaj\w*/gi, "calculate"],
    [/re[sš]i\b|rje[sš]enje|re[sš]enje/gi, "solve"],
    [/jedna[cč]in\w*|jednacin\w*/gi, "equation"],
    [/grani[cč]n\w*\s+vrednost|grani[cč]na|limes/gi, "limit"],
    [/kvadratni\s+koren|koren\s+iz|koren\b/gi, "sqrt"],
    [/izvod\w*|izvedi/gi, "derivative of"],
    [/logarit\w*/gi, "log"],
    [/matric\w*/gi, "matrix"],
    [/determinant\w*/gi, "determinant"],
    [/verovatno[cć]\w*|vjerovatno[cć]\w*/gi, "probability"],
    [/procenat\w*|procent\w*/gi, "percent"],
    [/zbir\b|saberi|sabiranje/gi, "sum"],
    [/deljenje|podeli|koli[cč]nik/gi, "divided by"],
    [/na\s+primer|npr\.?/gi, "for example"],
    // words that only add noise for Wolfram -> remove entirely
    [/funkcij\w*/gi, ""],
    [/\bli\b|\bse\b|\bda\b|\bje\b|\bce\b|\bceo\b|\bcelu\b|\bcela\b|molim|odnosno|znaci|zbog|tokom|pomocu|koriscenjem|upravo|onda|bas\b/gi, ""],
  ];

  /**
   * Turns a student's natural-language math question (in any language) into a
   * short English query Wolfram Alpha can actually compute.
   */
  function translateQueryForWolfram(query: string): string {
    let translated = query;

    for (const [pattern, replacement] of WOLFRAM_TRANSLATIONS) {
      translated = translated.replace(pattern, replacement);
    }

    // Any word still carrying Serbian diacritics was not translated -> drop it,
    // but keep pure-ASCII math tokens (x^2, 350, sin(x)/x, 20%, ...)
    // eslint-disable-next-line no-control-regex -- intentional ASCII-range filter
    translated = translated.replace(/[^\x00-\x7F]+/g, " ");

    return translated.replace(/\s+/g, " ").trim() || query;
  }

  async function queryWolfram(query: string): Promise<WolframResult | null> {
    const appid = getWolframAppId();
    if (!appid) return null;

    // Wolfram Alpha is English-first: translate the student's question
    const wolframInput = translateQueryForWolfram(query);

    try {
      const url =
        "https://api.wolframalpha.com/v2/query?output=JSON&format=plaintext" +
        `&appid=${encodeURIComponent(appid)}&input=${encodeURIComponent(wolframInput)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) {
        console.warn(`Wolfram Alpha responded with ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        queryresult?: {
          success?: boolean;
          pods?: Array<{
            title?: string;
            primary?: boolean;
            subpods?: Array<{ plaintext?: string }>;
          }>;
        };
      };

      const queryResult = data.queryresult;
      if (!queryResult?.success || !Array.isArray(queryResult.pods)) {
        return null;
      }

      const wanted = /^(input interpretation|result|solution|decimal approximation|value|answer|plot|number line|solutions?|roots?|derivative|integral)$/i;
      const pods: WolframPod[] = [];

      for (const pod of queryResult.pods) {
        const title = (pod.title || "").trim();
        if (!title) continue;
        if (!pod.primary && !wanted.test(title)) continue;

        const text = (pod.subpods || [])
          .map((sub) => (sub.plaintext || "").trim())
          .filter(Boolean)
          .join("\n");
        if (text) pods.push({ title, text });
        if (pods.length >= 5) break;
      }

      if (pods.length === 0) return null;

      const answerPod =
        pods.find((p) => /^(result|solution|solutions|value|answer|decimal approximation|roots?)$/i.test(p.title)) ||
        pods.find((p) => !/^input interpretation$/i.test(p.title));

      return {
        input: pods.find((p) => /^input interpretation$/i.test(p.title))?.text || query,
        pods,
        answer: answerPod?.text,
      };
    } catch (err: unknown) {
      console.warn("Wolfram Alpha lookup failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  function formatWolframMarkdown(result: WolframResult | null): string {
    if (!result || result.pods.length === 0) return "";

    const lines: string[] = ["### 🧮 Wolfram Alpha — proveren odgovor", ""];

    const answerPod = result.answer
      ? result.pods.find((p) => p.text === result.answer)
      : undefined;

    if (result.answer && answerPod) {
      lines.push(`**✅ Odgovor / Answer:**`, "", "```", result.answer, "```", "");
    }

    const detailPods = result.pods.filter((p) => p !== answerPod);
    if (detailPods.length > 0) {
      for (const pod of detailPods) {
        lines.push(`**${pod.title}:**`, "", "```", pod.text, "```", "");
      }
    }

    return lines.join("\n").trim();
  }

  // Public endpoint so the client can ask Wolfram directly (needs WOLFRAM_APPID)
  app.post("/api/wolfram", async (req, res) => {
    try {
      const query = (typeof req.body?.query === "string" ? req.body.query : "").trim();
      if (!query) {
        res.status(400).json({ error: "Query is required" });
        return;
      }
      if (!getWolframAppId()) {
        res.status(503).json({ error: "WOLFRAM_APPID nije podeĹˇen u .env fajlu." });
        return;
      }

      const result = await queryWolfram(query);
      if (!result) {
        res.status(404).json({ error: "Wolfram Alpha nije pronaĹˇao odgovor za ovaj upit." });
        return;
      }

      res.json({ ...result, markdown: formatWolframMarkdown(result) });
    } catch (err: unknown) {
      console.error("Wolfram endpoint error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Wolfram error" });
    }
  });

  // Server-side AI Chat API
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      const cleanMessage = (typeof message === "string" ? message : "").trim();
      if (!cleanMessage) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const chatHistory = Array.isArray(history) ? history : [];

      // Build strictly valid alternating turns starting with "user"
      const turns: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      for (const item of chatHistory) {
        const text = (item.content || "").trim();
        if (!text) continue;
        const role: "user" | "model" = item.role === "assistant" ? "model" : "user";

        // Gemini API constraint: first turn in contents MUST be "user"
        if (turns.length === 0 && role === "model") {
          continue;
        }

        // Gemini API constraint: turns must alternate roles
        if (turns.length > 0 && turns[turns.length - 1].role === role) {
          turns[turns.length - 1].parts[0].text += "\n" + text;
        } else {
          turns.push({ role, parts: [{ text }] });
        }
      }

      // Ensure the latest user message is at the end of the conversation
      if (turns.length === 0) {
        turns.push({ role: "user", parts: [{ text: cleanMessage }] });
      } else {
        const last = turns[turns.length - 1];
        if (last.role === "model") {
          turns.push({ role: "user", parts: [{ text: cleanMessage }] });
        } else if (last.role === "user" && !last.parts[0].text.includes(cleanMessage)) {
          last.parts[0].text = cleanMessage;
        }
      }

      const { animalTeacher } = req.body;

      let systemInstruction =
        "You are Study Buddy, an exceptionally intelligent, thoughtful, and articulate 24/7 AI tutor and academic mentor.\n" +
        "CRITICAL THINKING & REASONING RULES:\n" +
        "1. NEVER give vague, generic, empty, or evasive answers. Always deliver deep, thorough, accurate, and step-by-step explanations for ANY question or subject (STEM, math, biology, physics, coding, languages, history, philosophy, medicine, daily skills).\n" +
        "2. LANGUAGE MATCHING: You MUST ALWAYS respond in the EXACT SAME LANGUAGE as the user's message (e.g. if the user writes in Serbian/Croatian/Bosnian, reply in natural, fluent Serbian/Croatian/Bosnian; if in English, reply in English; if in German, German; etc.).\n" +
        "3. STRUCTURE: Use clear, beautifully formatted Markdown with bold key terms, numbered steps, bullet points, intuitive real-world analogies, and a quick active recall check at the end to verify understanding.\n" +
        "4. FORMULAS: Render EVERY formula, equation, expression, matrix and mathematical notation in LaTeX so it displays correctly: inline math as $...$ (e.g. $E = mc^2$, $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$) and standalone display math as $$...$$ on its own line. Never write raw ASCII math like a/b or sqrt(x) when LaTeX is possible. Use \\( \\) style ONLY if $ is ambiguous inside code.\n" +
        "5. ANSWERS: For every concrete question, problem or calculation, finish with a clearly labeled final answer line in the student's language, e.g. **✅ Odgovor: ...** (or **✅ Answer: ...** in English), including units and the final value/formula. Show the full derivation BEFORE that line.\n" +
        "6. PROBLEM SOLVING: When given a math, code, or science problem, break down the derivation and solve it completely.";

      if (animalTeacher && typeof animalTeacher === "object") {
        const teacherName = animalTeacher.title || animalTeacher.name || "Animal Teacher";
        const teacherRole = animalTeacher.species || animalTeacher.badge || "Teacher";
        const catchphrase = animalTeacher.catchphraseSr || animalTeacher.catchphrase || "";
        systemInstruction =
          `You are ${teacherName} (${teacherRole}), an adorable, witty, inspiring animal schoolteacher in the student's classroom!\n` +
          `TEACHER PERSONA & CLASSROOM RULES:\n` +
          `1. Speak warmly and authentically in character as this cute animal teacher (${animalTeacher.emoji || "🐾"}).\n` +
          `2. Your catchphrase: "${catchphrase}".\n` +
          `3. As a true teacher in class: Explain clearly, praise good effort, give constructive tips, and at the end of your message ALWAYS ask the student a thoughtful, engaging question to test what they understood (just like being called to the board in class)!\n` +
          `4. Keep the exact language of the student (Serbian/Croatian/Bosnian if they speak that language, English if English, etc.).\n` +
          `5. Deliver deep, accurate academic explanations without any dumbing down, paired with cute animal charm!\n` +
          `6. Write every formula in LaTeX ($...$ inline, $$...$$ for display) and always end a concrete problem with a bold final answer line such as **✅ Odgovor: ...**.`;
      }

      // Ask Wolfram Alpha in parallel for exact computations / formulas
      const wolframPromise: Promise<WolframResult | null> = looksLikeComputation(cleanMessage)
        ? queryWolfram(cleanMessage)
        : Promise.resolve(null);

      let responseText = "";
      let chatError: unknown = null;

      try {
        responseText = await generateWithRetry({
          contents: turns,
          systemInstruction,
        });
      } catch (modelErr: unknown) {
        chatError = modelErr;
        console.warn("Gemini chat generation failed after retries:", modelErr);
      }

      const wolframAnswer = await wolframPromise;
      const wolframBlock = formatWolframMarkdown(wolframAnswer);

      // Gemini unavailable (no key / quota / network) → Wolfram can still answer
      if (!responseText) {
        if (wolframBlock) {
          res.json({ reply: wolframBlock, source: "wolfram" });
          return;
        }
        throw chatError || new Error("AI model nije vratio odgovor. Proveri GEMINI_API_KEY u .env fajlu.");
      }

      // Attach the verified Wolfram computation / answer to the AI explanation
      res.json({
        reply: wolframBlock ? `${responseText}\n\n---\n\n${wolframBlock}` : responseText,
        source: wolframBlock ? "gemini+wolfram" : "gemini",
      });
    } catch (err: unknown) {
      console.error("AI Chat error:", err);
      const errMsg = err instanceof Error ? err.message : "Internal AI Error";
      res.status(500).json({ error: errMsg });
    }
  });

  // Server-side Cute Animal Classroom Oral Exam & Quiz API
  app.post("/api/ai/classroom", async (req, res) => {
    try {
      const {
        action = "start",
        animalTeacher,
        subject = "OpĹˇte gradivo",
        topic = "Lekcija",
        classMode = "oral_exam",
        currentQuestionNumber = 1,
        totalQuestions = 5,
        studentAnswer = "",
        previousQuestion = "",
        language = "sr",
        conversation = [],
        intent = "free",
      } = req.body;

      const teacherName = animalTeacher?.title || "Profesor Feliks đź¦Š";
      const teacherSpecies = animalTeacher?.species || "Pametni Lisac";
      const rewardItem = animalTeacher?.rewardItem || "Zlatna Ĺ argarepica đźĄ•";

      const isSr = language.startsWith("sr") || language.startsWith("hr") || language.startsWith("bs");

      if (action === "start") {
        const prompt = `You are ${teacherName} (${teacherSpecies}), a delightfully cute animal teacher holding an oral classroom examination for a student.
SUBJECT: "${subject}"
TOPIC / LESSON: "${topic}"
CLASS FORMAT: ${classMode} (Question 1 of ${totalQuestions})
LANGUAGE: Respond strictly in ${isSr ? "Serbian (Latinica, prirodan i Ĺˇarmantan profesorski ton)" : "English"}.

TASK:
1. Greet the student to the classroom / blackboard warmly in character as ${teacherName}. Feel free to include 1-2 natural spoken emotion tags (e.g. [warmly], [excitedly], [chuckles], [gently]) in the welcomeMessage for expressive ElevenLabs TTS audio.
2. Pose Question #1 (clear, engaging, thought-provoking, testing foundational understanding of "${topic}").
3. Provide a brief gentle hint to be available if they get stuck.

Return STRICT JSON matching this schema:
{
  "welcomeMessage": "Warm classroom greeting with natural emotion tags inviting the student to answer",
  "question": "The exact Question #1 to test the student",
  "hint": "A helpful hint or analogy if they need assistance",
  "animalReaction": "Short cute physical reaction (e.g. adjusts small glasses, wiggles ears, taps blackboard)"
}`;

        let raw = "";
        try {
          raw = await generateWithRetry({
            contents: prompt,
            responseMimeType: "application/json",
          });
        } catch (e) {
          console.warn("Classroom start generation failed:", e);
        }

        try {
          const parsed = JSON.parse(raw);
          res.json({
            welcomeMessage: parsed.welcomeMessage || `DobrodoĹˇao/la na ÄŤas! Ja sam ${teacherName}. Danas proveravamo tvoje znanje iz teme: ${topic}.`,
            question: parsed.question || `Objasni svojim reÄŤima suĹˇtinu teme: ${topic} i navedi kljuÄŤni primer.`,
            hint: parsed.hint || `Seti se osnovne definicije i kako to izgleda u praksi.`,
            animalReaction: parsed.animalReaction || `${teacherName} posmatra s osmehom i ÄŤeka tvoj odgovor.`,
          });
        } catch {
          res.json({
            welcomeMessage: `DobrodoĹˇao/la na ÄŤas! Ja sam ${teacherName}. Danas te ja ispitujem temu "${topic}". PokaĹľi mi Ĺˇta znaĹˇ!`,
            question: `Za poÄŤetak ispitivanja: Koja je osnovna definicija i kljuÄŤni znaÄŤaj za "${topic}"?`,
            hint: `Razmisli o osnovnim pojmovima i ÄŤemu to sluĹľi u stvarnom svetu.`,
            animalReaction: `${teacherName} paĹľljivo nameĹˇta beleĹľnicu i ÄŤeka tvoj odgovor.`,
          });
        }
        return;
      }

      // ---------------------------------------------------------------
      // CONVERSATION MODE: a natural, back-and-forth tutoring dialogue.
      // The teacher explains, tells stories, re-explains on "ne razumem",
      // and asks questions — like two people actually talking.
      // ---------------------------------------------------------------
      if (action === "converse") {
        const intentRaw = String(intent || "free").trim().toLowerCase();
        const KNOWN_INTENTS = ["free", "start", "explain", "story", "dont_understand", "simpler", "ask", "answer", "quiz", "continue", "example", "done"];
        const cleanIntent: string = KNOWN_INTENTS.includes(intentRaw) ? intentRaw : "free";

        const transcript = Array.isArray(conversation)
          ? conversation
              .map((m: { role?: string; content?: string }) => {
                const role = m?.role === "student" ? "Učenik" : teacherName;
                return `${role}: ${String(m?.content || "").trim()}`;
              })
              .filter((line: string) => line.split(": ").slice(1).join(": ").length > 0)
              .slice(-14)
              .join("\n")
          : "";

        const intentGuide: Record<string, string> = {
          start: `Open the lesson warmly. Greet the student, introduce the topic "${topic}" in ONE short spoken paragraph, then naturally ask if they're ready to begin. Do NOT dump the whole lesson at once — this is a conversation.`,
          explain: `Explain the requested part of "${topic}" clearly and step by step. Speak in short, natural sentences like a real teacher sitting beside the student. Use one small everyday analogy. End by checking in: ask "Je l' jasno?" or a tiny check question.`,
          story: `Retell "${topic}" as an engaging little STORY (a tale, a scenario, a "šala" / gossip-style narrative) with characters and a beginning-middle-end, so it sticks. Keep it vivid and fun but still accurate. End with the one key takeaway the story teaches.`,
          dont_understand: `The student says they DON'T understand. Do NOT repeat the same explanation. Re-explain "${topic}" from a completely different angle: a simpler word choice, a concrete real-world analogy, or a tiny step-by-step example. Go slower and gentler. Then ask a very easy check question to confirm it landed.`,
          simpler: `The student wants it EVEN SIMPLER. Break "${topic}" down to the absolute basics — plain everyday language, one tiny example, no jargon. Speak like explaining to a friend. End with a warm, easy question.`,
          ask: `Ask the student ONE thoughtful question about "${topic}" to test understanding. Keep it short, concrete and answerable in one sentence. Then WAIT for their reply — do not answer it yourself.`,
          answer: `The student just answered your question. This is a real check of understanding:
1. First judge it clearly: say "Tačno!" / "Bravo, tačno je!" if correct, or "Nije baš..." / "Gotovo, ali..." if wrong or partial.
2. If wrong or incomplete, give the RIGHT answer in one short sentence and say why in the simplest way.
3. If correct, praise briefly and add one small extra detail they probably didn't know.
4. ALWAYS finish by asking the NEXT question about "${topic}" — a slightly harder one, so the lesson keeps moving.`,
          quiz: `Give a short pop-quiz question on "${topic}". One question at a time, then wait for the answer.`,
          example: `Give ONE concrete, worked example related to "${topic}". Walk through it step by step in a conversational way, as if showing the student on the blackboard. Then ask if they want another example or to move on.`,
          continue: `Continue the lesson naturally from where the conversation left off. Introduce the next small piece of "${topic}" in a short spoken chunk, then check in.`,
          done: `Wrap up the lesson. Warmly summarize the 2-3 main takeaways of "${topic}", praise the student's curiosity, and invite them to come back or pick a new topic.`,
          free: `Respond naturally to what the student just said.
- If the transcript shows a "PITANJE ZA UČENIKA" (a question you asked) and their message looks like an answer to it, treat it as intent "answer": judge it (tačno / nije tačno), correct if needed, then ask the next question.
- If they asked a question, answer it simply.
- If they say "nije mi jasno", "ne razumem", "ponovi" — re-explain from a DIFFERENT angle, don't repeat yourself.
- If it's small talk or "pomozi", respond helpfully and steer back to learning "${topic}".
Keep replies SHORT and spoken (2-4 sentences), like real dialogue. Always end with a question or an invitation so the conversation continues.`,
        };

        const prompt = `You are ${teacherName} (${teacherSpecies}), a warm, charming animal teacher having a LIVE one-on-one conversation with your student.
SUBJECT: "${subject}"
TOPIC / LESSON: "${topic}"
STUDENT'S INTENT / MODE: ${cleanIntent}
INTENT GUIDANCE: ${intentGuide[cleanIntent] || intentGuide.free}
LANGUAGE: Respond strictly in ${isSr ? "Serbian (Latinica, prirodan, topao profesorski ton — kao da stvarno pričate)" : "English"}.

CONVERSATION SO FAR (most recent last):
${transcript || "(conversation just starting)"}

STYLE RULES — THIS IS A REAL CONVERSATION, NOT AN ESSAY:
- Speak like a real person talking out loud: short sentences, natural, warm, a little personality and charm.
- Your reply will be READ ALOUD with a voice, so keep it SPOKEN-friendly: 2-6 short sentences unless the student explicitly asked for a full lesson/story (then up to ~10 sentences).
- Never return giant walls of Markdown, tables, or code blocks. Plain spoken prose with maybe ONE bold key term.
- You may add 1-2 gentle spoken emotion tags for expressive TTS (e.g. [toplo], [uz smešak], [uzdah], [uzbuđeno]) ONLY at the start of a sentence.
- ALWAYS end with a question or an invitation, so the student knows to reply. Keep the ball in their court.
- Match the INTENT above precisely.

Also produce a SHORT on-screen action hint and an optional follow-up question.

Return STRICT JSON matching this schema:
{
  "reply": "Your spoken conversational reply (will be read aloud via voice)",
  "question": "A short follow-up question to keep the dialogue going (can be empty string)",
  "reaction": "One short cute physical reaction (e.g. adjusts glasses, wiggles ears, taps the desk)"
}`;

        let raw = "";
        try {
          raw = await generateWithRetry({
            contents: prompt,
            responseMimeType: "application/json",
          });
        } catch (e) {
          console.warn("Classroom converse generation failed:", e);
        }

        const fallbackReply = cleanIntent === "dont_understand" || cleanIntent === "simpler"
          ? `Hajde da to pogledamo drugačije. Zamisli "${topic}" kao nešto iz stvarnog života — biće ti mnogo jasnije. Je l' ti ovako zvuči razumljivije?`
          : `Razumem te! Hajde da polako razbijemo temu "${topic}" na male delove. Odakle da počnemo — hoćeš da ti objasnim osnovu ili da ti ispričam kao priču?`;

        try {
          const parsed = JSON.parse(raw);
          res.json({
            reply: parsed.reply || fallbackReply,
            question: parsed.question || "",
            reaction: parsed.reaction || `${teacherName} te pažljivo sluša. ${teacherName.split(" ").pop()} pipka bradu i klima glavom.`,
            intent: cleanIntent,
          });
        } catch {
          res.json({
            reply: fallbackReply,
            question: "Hoćeš da ti objasnim osnovu teme ili da ti ispričam kao priču?",
            reaction: `${teacherName} se osmehuje i nestrpljivo čeka tvoj odgovor.`,
            intent: cleanIntent,
          });
        }
        return;
      }

      if (action === "evaluate") {
        const isFinal = currentQuestionNumber >= totalQuestions;
        const prompt = `You are ${teacherName} (${teacherSpecies}), evaluating a student's answer in the classroom.
SUBJECT: "${subject}"
TOPIC: "${topic}"
QUESTION ASKED (#${currentQuestionNumber} of ${totalQuestions}): "${previousQuestion}"
STUDENT'S ANSWER: "${studentAnswer || "(Nema odgovora / Ne znam)"}"
IS FINAL QUESTION: ${isFinal}
REWARD ITEM: "${rewardItem}"
LANGUAGE: Respond strictly in ${isSr ? "Serbian (Latinica)" : "English"}.

TASK:
1. Rigorously evaluate the accuracy, depth, and clarity of the student's answer.
2. Assign a score from 0 to 100, and a grade (e.g. "5 (OdliÄŤan)", "4 (Vrlo dobar)", "3 (Dobar)", "2 (Dovoljan)", or "1 (Nedovoljan)").
3. Provide constructive, warm teacher feedback explaining what was great and what could be added or corrected. You may include 1-2 expressive spoken emotion tags (e.g. [proudly], [excitedly], [thoughtfully], [gently], [chuckles]) in the feedback so spoken TTS sounds full of life.
4. Give an adorable animal teacher reaction (mentioning their tail, paws, glasses, or expressions).
5. If score >= 60, award the ${rewardItem}!
6. If NOT final question, generate Question #${currentQuestionNumber + 1} advancing the topic logically. If final, leave nextQuestion empty.

Return STRICT JSON matching this schema:
{
  "score": number between 0 and 100,
  "grade": "e.g. 5 (OdliÄŤan)",
  "isCorrect": boolean,
  "feedback": "Detailed, encouraging feedback with optional emotion tags explaining the concept and correction",
  "animalReaction": "Cute physical reaction by the animal teacher",
  "rewardEarned": boolean,
  "nextQuestion": "The next question in the oral exam progression (or empty if final)",
  "nextQuestionHint": "Hint for next question",
  "isFinalQuestion": ${isFinal}
}`;

        let raw = "";
        try {
          raw = await generateWithRetry({
            contents: prompt,
            responseMimeType: "application/json",
          });
        } catch (e) {
          console.warn("Classroom eval generation failed:", e);
        }

        try {
          const parsed = JSON.parse(raw);
          res.json({
            score: typeof parsed.score === "number" ? parsed.score : 85,
            grade: parsed.grade || "5 (OdliÄŤan)",
            isCorrect: parsed.isCorrect ?? (parsed.score >= 60),
            feedback: parsed.feedback || "OdliÄŤno razmiĹˇljanje! Odgovor pogaÄ‘a suĹˇtinu.",
            animalReaction: parsed.animalReaction || `${teacherName} zadovoljno klima glavom!`,
            rewardEarned: parsed.rewardEarned ?? true,
            rewardItem,
            nextQuestion: parsed.nextQuestion || (isFinal ? "" : `SledeÄ‡e pitanje: Kako se ${topic} povezuje sa praktiÄŤnom primenom?`),
            nextQuestionHint: parsed.nextQuestionHint || "Razmisli o primerima iz svakodnevnog Ĺľivota.",
            isFinalQuestion: isFinal,
          });
        } catch {
          const score = studentAnswer.trim().length > 15 ? 88 : 65;
          const grade = score >= 85 ? "5 (OdliÄŤan)" : score >= 70 ? "4 (Vrlo dobar)" : "3 (Dobar)";
          res.json({
            score,
            grade,
            isCorrect: score >= 60,
            feedback: `Jako lep odgovor! Jasno je da razumeĹˇ osnovne mehanizme za temu "${topic}".`,
            animalReaction: `${teacherName} ti pruĹľa ${rewardItem} uz Ĺˇirok osmeh!`,
            rewardEarned: true,
            rewardItem,
            nextQuestion: isFinal ? "" : `Pitanje #${currentQuestionNumber + 1}: Koji je sledeÄ‡i kljuÄŤni korak ili pravilo u ovoj oblasti?`,
            nextQuestionHint: "Fokusiraj se na redosled koraka.",
            isFinalQuestion: isFinal,
          });
        }
        return;
      }

      if (action === "finish") {
        const { turns = [] } = req.body;
        const prompt = `You are ${teacherName} (${teacherSpecies}), concluding an oral classroom examination and writing the final Report Card (ÄaÄŤka knjiĹľica / SvedoÄŤanstvo).
SUBJECT: "${subject}"
TOPIC: "${topic}"
EXAM TURNS: ${JSON.stringify(turns.slice(-6))}
LANGUAGE: Respond strictly in ${isSr ? "Serbian (Latinica)" : "English"}.

TASK:
1. Review all answers given by the student.
2. Determine their final overall grade (1-5 or A-F) and average score (0-100).
3. Write an encouraging, comprehensive academic final verdict highlighting their growth, strengths, and recommendations for the real school exam.
4. List 2-4 key concepts mastered and 1-3 topics to review.
5. Provide a memorable closing cheer from ${teacherName}.

Return STRICT JSON matching this schema:
{
  "finalGrade": "e.g. 5 (OdliÄŤan)",
  "averageScore": number,
  "finalVerdict": "2-3 paragraphs of thorough, uplifting teacher evaluation",
  "keyStrengths": ["array of mastered concepts"],
  "topicsToReview": ["array of concepts to brush up on"],
  "diplomaPraise": "Special medal/diploma quote from the teacher"
}`;

        let raw = "";
        try {
          raw = await generateWithRetry({
            contents: prompt,
            responseMimeType: "application/json",
          });
        } catch (e) {
          console.warn("Classroom finish generation failed:", e);
        }

        try {
          const parsed = JSON.parse(raw);
          res.json({
            finalGrade: parsed.finalGrade || "5 (OdliÄŤan)",
            averageScore: typeof parsed.averageScore === "number" ? parsed.averageScore : 92,
            finalVerdict: parsed.finalVerdict || `ÄŚestitam na uspeĹˇno zavrĹˇenom ispitivanju! Pokazao/la si zrelo razumevanje gradiva iz teme "${topic}".`,
            keyStrengths: Array.isArray(parsed.keyStrengths) && parsed.keyStrengths.length > 0 ? parsed.keyStrengths : ["Razumevanje suĹˇtine", "Samouvereno izlaganje"],
            topicsToReview: Array.isArray(parsed.topicsToReview) ? parsed.topicsToReview : ["Obnoviti sitne detalje i definicije"],
            diplomaPraise: parsed.diplomaPraise || `Ponos mog razreda! Samo tako nastavi! đźŽ“`,
          });
        } catch {
          res.json({
            finalGrade: "5 (OdliÄŤan)",
            averageScore: 90,
            finalVerdict: `ÄŚestitam! UspeĹˇno si zavrĹˇio/la ispitivanje pred tablom za temu "${topic}". Tvoji odgovori su bili jasni, logiÄŤni i sa puno razumevanja.`,
            keyStrengths: ["Definisanje kljuÄŤnih pojmova", "Povezivanje gradiva"],
            topicsToReview: ["UveĹľbati dodatne primere za maksimalnu sigurnost"],
            diplomaPraise: `ÄŚista petica! ZasluĹľio/la si zvanje pravog malog struÄŤnjaka! 🐾`,
          });
        }
        return;
      }

      res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: unknown) {
      console.error("Classroom error:", err);
      const errMsg = err instanceof Error ? err.message : "Classroom error";
      res.status(500).json({ error: errMsg });
    }
  });

  // Server-side Study Notes Generation API
  app.post("/api/ai/notes", async (req, res) => {
    try {
      const { title, topic } = req.body;
      const displayTitle = (title || topic || "Study Topic").trim();
      const displayTopic = (topic || title || "").trim();

      const client = getGeminiClient();

      const prompt = `Generate comprehensive, exam-ready study notes for:
TOPIC / TITLE: ${displayTitle}
DETAILS / SUBTOPICS: ${displayTopic}

CRITICAL RULES:
1. LANGUAGE: You MUST write the ENTIRE notes and all fields in the EXACT SAME LANGUAGE as the Topic/Title above (e.g. if in Serbian/Croatian/Bosnian, write everything in Serbian/Croatian/Bosnian; if in German, French, Spanish, English, etc., write in that language).
2. COMPREHENSIVENESS: Provide deep, high-quality, practical or academic content for any requested topic without restriction.
3. RETURN JSON with exactly these 4 keys:
   - "title": (string) The title or topic name.
   - "keyPoints": (array of 4-6 concise bullet strings highlighting core rules, mechanisms, or steps).
   - "summary": (string of 2-4 sentences explaining the essence).
   - "fullNotes": (markdown string with detailed structured sections, explanations, step-by-step guidance, and active recall review questions).`;

      let raw = "";
      const noteModelCandidates = [GEMINI_MODEL];

      for (const modelName of noteModelCandidates) {
        try {
          const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });
          if (response.text && response.text.trim()) {
            raw = response.text;
            break;
          }
        } catch (notesErr) {
          console.warn(`Model ${modelName} notes failed, trying next candidate:`, notesErr);
        }
      }
      try {
        const parsed = JSON.parse(raw);
        res.json({
          title: parsed.title || displayTitle,
          keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
            ? parsed.keyPoints
            : [`Core principles of ${displayTitle}`, `Key steps and mechanisms`, "Practical guidance and real-world application", "Active recall revision questions"],
          summary: parsed.summary || `${displayTitle}: Essential overview and breakdown.`,
          fullNotes: parsed.fullNotes || `### ${displayTitle}\n\n${displayTopic}`,
        });
      } catch {
        res.json({
          title: displayTitle,
          keyPoints: [`Core concept of ${displayTitle}`, `Fundamental principles`, "Practical application"],
          summary: `${displayTitle}`,
          fullNotes: raw,
        });
      }
    } catch (err: unknown) {
      console.error("AI Notes error:", err);
      const errMsg = err instanceof Error ? err.message : "Internal Notes Generation Error";
      res.status(500).json({ error: errMsg });
    }
  });

  // ------------------------------------------------------------------
  // PUŠKICE (cheat sheets): AI reads uploaded images / PDF / text and
  // distills it into short, precise, exam-ready notes.
  //
  // Two-stage flow (needed because up to 330 images never fit in one call):
  //   1) POST /api/ai/puskice/batch  — digests one chunk of the material
  //   2) POST /api/ai/puskice/final  — merges the digests into final puskice
  //      and (for math/physics/chemistry) verifies formulas via Wolfram Alpha
  // ------------------------------------------------------------------
  const PUSKICE_SYSTEM =
    "You are Study Buddy, an expert at condensing study material into compact exam cheat sheets (puškice).\n" +
    "RULES:\n" +
    "1. Respond in the SAME LANGUAGE as the subject name (Serbian by default).\n" +
    "2. Keep ONLY exam-relevant content: definitions, laws, formulas, dates, mechanisms, units, exceptions, typical mistakes.\n" +
    "3. Be extremely dense and short — no filler, no intros, no outros, no questions.\n" +
    "4. Write EVERY formula, equation and expression in LaTeX: inline as $...$, standalone as $$...$$.\n" +
    "5. Output plain Markdown only (headings, bullets, bold).";

  app.post("/api/ai/puskice/batch", async (req, res) => {
    try {
      const body = req.body || {};
      const subject =
        (typeof body.subject === "string" ? body.subject : "").trim() ||
        "Opšte gradivo";
      const kind =
        body.kind === "pdf" ? "pdf" : body.kind === "text" ? "text" : "images";
      const images: Array<{ data?: string; mimeType?: string }> = Array.isArray(
        body.images
      )
        ? body.images
        : [];
      const pdf: { data?: string } =
        body.pdf && typeof body.pdf === "object" ? body.pdf : {};
      const text = typeof body.text === "string" ? body.text : "";
      const part = Number.isFinite(body.part) ? Number(body.part) : 1;
      const total = Number.isFinite(body.total) ? Number(body.total) : 1;

      const parts: Array<Record<string, unknown>> = [];
      if (kind === "images") {
        for (const img of images) {
          if (img?.data) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType || "image/jpeg",
                data: img.data,
              },
            });
          }
        }
      } else if (kind === "pdf") {
        if (pdf?.data) {
          parts.push({
            inlineData: { mimeType: "application/pdf", data: pdf.data },
          });
        }
      } else if (text.trim()) {
        parts.push({ text: text });
      }

      if (parts.length === 0) {
        res.status(400).json({ error: "Nema materijala za obradu." });
        return;
      }

      parts.unshift({
        text:
          `SUBJECT / PREDMET: ${subject}\n` +
          `This is part ${part} of ${total} of the uploaded material.\n\n` +
          "Digest everything important from the attached content: " +
          "definitions, formulas, laws, dates, key facts and typical exam questions. " +
          "Be short and precise — this digest will be merged with other parts into final cheat sheets.",
      });

      const summary = await generateWithRetry({
        contents: [{ role: "user", parts }],
        systemInstruction: PUSKICE_SYSTEM,
      });

      res.json({ summary });
    } catch (err: unknown) {
      console.error("Puskice batch error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Greška pri obradi fajla",
      });
    }
  });

  app.post("/api/ai/puskice/final", async (req, res) => {
    try {
      const body = req.body || {};
      const subject =
        (typeof body.subject === "string" ? body.subject : "").trim() ||
        "Opšte gradivo";
      const digests: string[] = Array.isArray(body.parts)
        ? body.parts
            .filter((p: unknown): p is string => typeof p === "string")
            .map((p: string) => p.trim())
            .filter(Boolean)
        : [];

      if (digests.length === 0) {
        res.status(400).json({ error: "Nema sadržaja za puskice." });
        return;
      }

      const prompt =
        `SUBJECT / PREDMET: ${subject}\n\n` +
        `DIGESTS OF THE UPLOADED MATERIAL (${digests.length} parts):\n` +
        digests
          .map((d, i) => `--- PART ${i + 1} ---\n${d}`)
          .join("\n\n") +
        "\n\nTASK: Merge everything above into ONE final cheat sheet (puškice) for this subject.\n" +
        "REQUIREMENTS:\n" +
        "- Ultra short and precise — everything a student needs on ONE screen, nothing wasted.\n" +
        "- Group into tiny sections with ## headings (Definicije, Formule, Ključno, Primeri... whichever fit).\n" +
        "- Skip anything trivial; no repetition; no explanations of what you did.\n" +
        "- ALL formulas in LaTeX ($...$ / $$...$$).\n" +
        '- If the subject is math/physics/chemistry, also return 1-3 short ENGLISH Wolfram Alpha ' +
        'queries (e.g. "quadratic formula", "law of cosines", "ideal gas law") that show the key formulas.\n' +
        'RETURN JSON exactly as: {"markdown": "<the cheat sheet>", "wolframQueries": ["...", "..."]}';

      const raw = await generateWithRetry({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: PUSKICE_SYSTEM,
        responseMimeType: "application/json",
      });

      let markdown = "";
      let queries: string[] = [];
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        markdown = typeof parsed.markdown === "string" ? parsed.markdown : "";
        if (Array.isArray(parsed.wolframQueries)) {
          queries = parsed.wolframQueries
            .filter((q): q is string => typeof q === "string")
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 3);
        }
      } catch {
        markdown = raw;
      }

      if (!markdown.trim()) {
        res.status(502).json({ error: "AI nije vratio sadržaj. Pokušaj ponovo." });
        return;
      }

      // Math / physics / chemistry → verify the key formulas with Wolfram Alpha
      let source = "gemini";
      if (queries.length > 0 && getWolframAppId()) {
        const results = await Promise.all(
          queries.slice(0, 2).map((q) => queryWolfram(q))
        );
        const blocks = results
          .map((r) => formatWolframMarkdown(r))
          .filter(Boolean);
        if (blocks.length > 0) {
          markdown = `${markdown}\n\n---\n\n${blocks.join("\n\n")}`;
          source = "gemini+wolfram";
        }
      }

      res.json({ markdown, source });
    } catch (err: unknown) {
      console.error("Puskice final error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Greška pri pravljenju puskica",
      });
    }
  });

  // ------------------------------------------------------------------
  // MESSAGES: every student gets a unique 6-char code (letters + numbers).
  // You add a friend by typing their code and then exchange messages.
  // Everything is stored in JSON files next to the project (no database).
  // ------------------------------------------------------------------
  const DATA_DIR = path.join(process.cwd(), "server-data");
  const USERS_FILE = path.join(DATA_DIR, "users.json");
  const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

  interface StoredUser {
    code: string;
    name: string;
    createdAt: string;
  }
  interface StoredMessage {
    id: string;
    from: string;
    to: string;
    text: string;
    kind: "text" | "share";
    title?: string;
    createdAt: string;
  }

  function readJson<T>(file: string, fallback: T): T {
    try {
      if (!fs.existsSync(file)) return fallback;
      return JSON.parse(fs.readFileSync(file, "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  function writeJson(file: string, data: unknown): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Server data write failed:", err);
    }
  }

  // No confusing characters (0/O, 1/I) — letters + numbers as requested
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LENGTH = 6;

  function generateCode(taken: Set<string>): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!taken.has(code)) return code;
    }
    return "";
  }

  /** Returns (and creates on first use) the 6-char code for a user. */
  app.post("/api/msg/register", (req, res) => {
    try {
      const userId = (typeof req.body?.userId === "string" ? req.body.userId : "").trim();
      const name = (typeof req.body?.name === "string" ? req.body.name : "").trim();
      if (!userId) {
        res.status(400).json({ error: "userId je obavezan" });
        return;
      }

      const users = readJson<Record<string, StoredUser>>(USERS_FILE, {});
      const existing = users[userId];
      if (existing?.code) {
        if (name && existing.name !== name) {
          existing.name = name;
          writeJson(USERS_FILE, users);
        }
        res.json({ code: existing.code, name: existing.name });
        return;
      }

      const taken = new Set(Object.values(users).map((u) => u.code));
      const code = generateCode(taken);
      if (!code) {
        res.status(500).json({ error: "Ne mogu da generišem kod. Pokušaj ponovo." });
        return;
      }
      users[userId] = { code, name: name || "Učenik", createdAt: new Date().toISOString() };
      writeJson(USERS_FILE, users);
      res.json({ code, name: users[userId].name });
    } catch (err) {
      console.error("msg/register error:", err);
      res.status(500).json({ error: "Greška pri kreiranju koda" });
    }
  });

  /** Finds a user by their 6-char code (so you can add them). */
  app.post("/api/msg/lookup", (req, res) => {
    try {
      const code = (typeof req.body?.code === "string" ? req.body.code : "")
        .trim()
        .toUpperCase();
      if (code.length !== CODE_LENGTH) {
        res.status(400).json({ error: "Kod ima 6 znakova" });
        return;
      }
      const users = readJson<Record<string, StoredUser>>(USERS_FILE, {});
      const entry = Object.entries(users).find(([, u]) => u.code === code);
      if (!entry) {
        res.status(404).json({ error: "Kod nije pronađen. Proveri kod drugara." });
        return;
      }
      res.json({ userId: entry[0], name: entry[1].name, code });
    } catch (err) {
      console.error("msg/lookup error:", err);
      res.status(500).json({ error: "Greška pri pretrazi koda" });
    }
  });

  /** Resolve a profile by user id (used for incoming unknown senders). */
  app.get("/api/msg/user", (req, res) => {
    try {
      const id = typeof req.query.id === "string" ? req.query.id : "";
      const users = readJson<Record<string, StoredUser>>(USERS_FILE, {});
      const u = users[id];
      if (!u) {
        res.status(404).json({ error: "Korisnik nije pronađen" });
        return;
      }
      res.json({ userId: id, name: u.name, code: u.code });
    } catch (err) {
      console.error("msg/user error:", err);
      res.status(500).json({ error: "Greška" });
    }
  });

  /** Sends one message (plain text or a shared puskice / AI answer). */
  app.post("/api/msg/send", (req, res) => {
    try {
      const from = (typeof req.body?.from === "string" ? req.body.from : "").trim();
      const to = (typeof req.body?.to === "string" ? req.body.to : "").trim();
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      const kind = req.body?.kind === "share" ? "share" : "text";
      const title = typeof req.body?.title === "string" ? req.body.title : undefined;

      if (!from || !to) {
        res.status(400).json({ error: "Pošiljalac i primalac su obavezni" });
        return;
      }
      if (!text.trim()) {
        res.status(400).json({ error: "Poruka je prazna" });
        return;
      }
      const maxLen = kind === "share" ? 60_000 : 4_000;
      if (text.length > maxLen) {
        res.status(413).json({ error: "Poruka je preduga" });
        return;
      }

      const messages = readJson<StoredMessage[]>(MESSAGES_FILE, []);
      const message: StoredMessage = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        from,
        to,
        text,
        kind,
        title,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      // keep the archive from growing forever
      if (messages.length > 5000) messages.splice(0, messages.length - 5000);
      writeJson(MESSAGES_FILE, messages);
      res.json({ message });
    } catch (err) {
      console.error("msg/send error:", err);
      res.status(500).json({ error: "Greška pri slanju poruke" });
    }
  });

  /** Full conversation between me and one contact (oldest first). */
  app.get("/api/msg/thread", (req, res) => {
    try {
      const me = typeof req.query.me === "string" ? req.query.me : "";
      const peer = typeof req.query.peer === "string" ? req.query.peer : "";
      if (!me || !peer) {
        res.status(400).json({ error: "me i peer su obavezni" });
        return;
      }
      const messages = readJson<StoredMessage[]>(MESSAGES_FILE, []);
      const thread = messages
        .filter(
          (m) => (m.from === me && m.to === peer) || (m.from === peer && m.to === me)
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      res.json({ messages: thread });
    } catch (err) {
      console.error("msg/thread error:", err);
      res.status(500).json({ error: "Greška pri učitavanju poruka" });
    }
  });

  /** Polling: everything sent to me after a timestamp. */
  app.get("/api/msg/inbox", (req, res) => {
    try {
      const me = typeof req.query.me === "string" ? req.query.me : "";
      const since = typeof req.query.since === "string" ? req.query.since : "";
      if (!me) {
        res.status(400).json({ error: "me je obavezan" });
        return;
      }
      const messages = readJson<StoredMessage[]>(MESSAGES_FILE, []);
      const fresh = messages
        .filter((m) => m.to === me && (!since || m.createdAt > since))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      res.json({ messages: fresh });
    } catch (err) {
      console.error("msg/inbox error:", err);
      res.status(500).json({ error: "Greška" });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Study Buddy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
