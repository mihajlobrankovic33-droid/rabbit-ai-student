import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { EdgeTTS } from "node-edge-tts";

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

  app.use(express.json({ limit: "10mb" }));

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
      hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
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

  // Curated ElevenLabs voices
  const CURATED_ELEVENLABS_VOICES = [
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      name: "Rachel",
      gender: "female",
      traits: "Miran, topao, jasan glas nastavnice",
      persona: "PreporuÄŤeno za zeca Lolu i strpljivo uÄŤenje",
    },
    {
      id: "pNInz6obpgDQGcFmaJgB",
      name: "Adam",
      gender: "male",
      traits: "Dubok, autoritativan, mudar glas",
      persona: "PreporuÄŤeno za pandu Baoa i predavanja",
    },
    {
      id: "ErXwobaYiN019PkySvjV",
      name: "Antoni",
      gender: "male",
      traits: "Bistar, energiÄŤan, precizno artikulisan",
      persona: "PreporuÄŤeno za lisca Feliksa i kvizove",
    },
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      name: "Bella",
      gender: "female",
      traits: "IzraĹľajna, dinamiÄŤna, motiviĹˇuÄ‡a",
      persona: "PreporuÄŤeno za maÄŤku Micu i dijalog",
    },
    {
      id: "TxGEqnHWrfWFTfGW9XjX",
      name: "Josh",
      gender: "male",
      traits: "Prirodan, prijateljski edukator",
      persona: "OdliÄŤan za detaljna objaĹˇnjenja",
    },
    {
      id: "MF3mGyEYCl7XYWbV9V6O",
      name: "Elli",
      gender: "female",
      traits: "NeĹľna, vedra, kristalno jasna",
      persona: "OdliÄŤna za decu i lakĹˇe gradivo",
    },
    {
      id: "VR6AewLTigWG4xSOukaG",
      name: "Arnold",
      gender: "male",
      traits: "Fokusiran, jasan govor bez oklevanja",
      persona: "Idealan za definicije i formule",
    },
    {
      id: "NOpBlnGInO9m6vDvFkFC",
      name: "Zephyros (Eldoria Storyteller)",
      gender: "male",
      traits: "Mudar, ekspresivan, podrĹľava v3 audio tagove i emocije",
      persona: "PreporuÄŤeno za priÄŤe, v3 ekspresije i slikovita objaĹˇnjenja",
    },
    {
      id: "JBFqnCBsd6RMkjVDRZzb",
      name: "George (Topao & Izuzetno Stabilan)",
      gender: "male",
      traits: "Topao, smiren narator, vrhunska stabilnost sa prirodnim emocijama",
      persona: "PreporuÄŤeno za stabilan govor sa emocijama i lekcije",
    },
    {
      id: "cgSgspJ2msm6clMCkdW9",
      name: "Jessica (Ekspresivna & Stabilna)",
      gender: "female",
      traits: "Jasna, vedra, izraĹľajna dikcija sa Ĺľivom modulacijom",
      persona: "OdliÄŤna za konverzaciju, pitanja i dinamiÄŤno voÄ‘enje",
    },
  ];

  // List available TTS options
  app.get("/api/tts/voices", (_req, res) => {
    const envKey = (process.env.ELEVENLABS_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    const isServerKeyAnId = Boolean(envKey && !envKey.startsWith("sk_"));
    const hasElevenLabsKey = Boolean(envKey && envKey.startsWith("sk_"));

    res.json({
      hasElevenLabsKey,
      isServerKeyAnId,
      serverKeyLength: envKey.length,
      voices: CURATED_ELEVENLABS_VOICES,
      defaultModel: "eleven_v3",
      availableModels: ["eleven_v3", "eleven_multilingual_v2"],
    });
  });

  // Validate ElevenLabs API Key endpoint
  app.post("/api/tts/validate-key", async (req, res) => {
    try {
      const headerKey = typeof req.headers["x-elevenlabs-key"] === "string" ? req.headers["x-elevenlabs-key"].trim() : "";
      const bodyKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      const rawKey = bodyKey || headerKey || process.env.ELEVENLABS_API_KEY || "";
      const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

      if (!apiKey) {
        res.status(400).json({ valid: false, error: "Nije unet ElevenLabs API kljuÄŤ." });
        return;
      }

      // Check if user accidentally pasted the Key ID instead of the secret key
      if (!apiKey.startsWith("sk_")) {
        res.status(400).json({
          valid: false,
          error: "Uneli ste ID kljuÄŤa (Key ID) a ne tajni API kljuÄŤ! ElevenLabs API kljuÄŤevi uvek poÄŤinju sa 'sk_'. U ElevenLabs kontrolnoj tabli kreirajte novi kljuÄŤ ili kopirajte tajnu vrednost koja poÄŤinje sa 'sk_'.",
          isKeyId: true,
        });
        return;
      }

      const testRes = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });

      if (!testRes.ok) {
        const errText = await testRes.text();
        let parsedMessage = errText;
        let isKeyId = !apiKey.startsWith("sk_");
        try {
          const parsed = JSON.parse(errText);
          if (parsed.detail?.message) parsedMessage = parsed.detail.message;
          if (parsed.detail?.status === "api_key_id_used_as_api_key" || parsed.detail?.code === "invalid_api_key") {
            isKeyId = true;
          }
        } catch (parseErr) {
          console.warn("ElevenLabs test response parsing notice:", parseErr);
        }

        res.status(400).json({
          valid: false,
          error: isKeyId
            ? "Uneli ste ID kljuÄŤa (Key ID) a ne tajni API kljuÄŤ! ElevenLabs API kljuÄŤ uvek poÄŤinje sa 'sk_'. U ElevenLabs kontrolnoj tabli kliknite na '+ Create Key' i kopirajte tajni kljuÄŤ koji poÄŤinje sa 'sk_'."
            : `ElevenLabs greĹˇka: ${parsedMessage}`,
          isKeyId,
        });
        return;
      }

      const userData = await testRes.json().catch(() => ({}));
      const charCount = userData?.subscription?.character_count ?? 0;
      const charLimit = userData?.subscription?.character_limit ?? 0;
      const tier = userData?.subscription?.tier ?? "Free";

      res.json({
        valid: true,
        tier,
        characterCount: charCount,
        characterLimit: charLimit,
        remaining: Math.max(0, charLimit - charCount),
      });
    } catch (err) {
      res.status(500).json({
        valid: false,
        error: err instanceof Error ? err.message : "GreĹˇka pri proveri kljuÄŤa",
      });
    }
  });

  // ------------------------------------------------------------------
  // FREE neural text-to-speech (Microsoft Edge online TTS, no API key).
  // Natural-sounding voices including Serbian (sr-RS), Croatian, Bosnian.
  // This is the default voice for the app — ElevenLabs needs a paid plan.
  // ------------------------------------------------------------------
  const EDGE_VOICE_BY_LANG: Record<string, { male: string; female: string }> = {
    sr: { male: "sr-RS-NicholasNeural", female: "sr-RS-SophieNeural" },
    hr: { male: "hr-HR-SreckoNeural", female: "hr-HR-GabrijelaNeural" },
    bs: { male: "bs-BA-GoranNeural", female: "bs-BA-VesnaNeural" },
    en: { male: "en-US-AndrewNeural", female: "en-US-EmmaNeural" },
    de: { male: "de-DE-ConradNeural", female: "de-DE-KatjaNeural" },
    fr: { male: "fr-FR-RemyNeural", female: "fr-FR-DeniseNeural" },
    es: { male: "es-ES-AlvaroNeural", female: "es-ES-ElviraNeural" },
    it: { male: "it-IT-DiegoNeural", female: "it-IT-ElsaNeural" },
    ru: { male: "ru-RU-DmitryNeural", female: "ru-RU-SvetlanaNeural" },
    pt: { male: "pt-BR-AntonioNeural", female: "pt-BR-FranciscaNeural" },
    tr: { male: "tr-TR-AhmetNeural", female: "tr-TR-EmelNeural" },
  };

  const edgeAudioCache = new Map<string, Buffer>();
  const EDGE_CACHE_MAX_ENTRIES = 200;

  /** ratio (1 = normal speed) -> "+10%" / "-15%" prosody value. */
  function edgePercentFromRatio(ratio: unknown): string | undefined {
    if (typeof ratio !== "number" || !isFinite(ratio) || ratio <= 0) return undefined;
    const pct = Math.round((ratio - 1) * 100);
    if (pct === 0) return undefined;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }

  /** "+1.15" / 1.15 / "+15%" -> "+15%" (accepts what the client sends). */
  function edgePercentFromValue(value: unknown, isPitch = false): string | undefined {
    if (typeof value === "number" && isFinite(value)) {
      if (isPitch) {
        // Client pitch is a multiplier; map it to a modest Hz offset.
        const hz = Math.round((value - 1) * 15);
        return hz === 0 ? undefined : `${hz > 0 ? "+" : ""}${hz}Hz`;
      }
      return edgePercentFromRatio(value);
    }
    if (typeof value === "string" && value.trim()) {
      const raw = value.trim();
      if (/^[+-]?\d+(\.\d+)?%$/.test(raw)) {
        const num = parseFloat(raw);
        return `${num > 0 ? "+" : ""}${num}%`;
      }
      if (isPitch && /^[+-]?\d+(\.\d+)?Hz$/i.test(raw)) return raw;
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        if (isPitch) {
          const hz = Math.round((num - 1) * 15);
          return hz === 0 ? undefined : `${hz > 0 ? "+" : ""}${hz}Hz`;
        }
        return edgePercentFromRatio(num);
      }
    }
    return undefined;
  }

  // Edge occasionally rate-limits (429) when we ask for several sentences fast.
  // Serialize requests + retry with backoff so the free Serbian neural voice is
  // actually used instead of falling back to a voice that mangles Serbian.
  let edgeQueue: Promise<void> = Promise.resolve();
  const EDGE_MAX_ATTEMPTS = 4;
  const edgeSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function synthesizeEdge(
    text: string,
    voice: string,
    locale: string,
    rate?: string,
    pitch?: string
  ): Promise<Buffer> {
    const run = async (): Promise<Buffer> => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= EDGE_MAX_ATTEMPTS; attempt++) {
        try {
          const tts = new EdgeTTS({
            voice,
            lang: locale,
            rate: rate || "default",
            pitch: pitch || "default",
            timeout: 25000,
          });
          const chunks: Buffer[] = [];
          for await (const chunk of tts.streamAudio(text)) {
            if (Buffer.isBuffer(chunk) && chunk.length > 0) chunks.push(chunk);
          }
          const combined = Buffer.concat(chunks);
          if (combined.length > 0) return combined;
          lastErr = new Error("Edge returned empty audio");
        } catch (e) {
          lastErr = e;
        }
        if (attempt < EDGE_MAX_ATTEMPTS) {
          await edgeSleep(350 * attempt + Math.random() * 250);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error("Edge TTS failed");
    };

    // Chain onto the queue so requests go out one at a time.
    const result = edgeQueue.then(run, run);
    edgeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  function sendAudioWithRange(req: express.Request, res: express.Response, combined: Buffer): void {
    const range = req.headers.range;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : combined.length - 1;
      const chunksize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${combined.length}`);
      res.setHeader("Content-Length", chunksize);
      res.send(combined.subarray(start, end + 1));
    } else {
      res.setHeader("Content-Length", combined.length);
      res.send(combined);
    }
  }

  app.post("/api/tts/edge", async (req, res) => {
    try {
      const { text, lang = "sr", gender = "male", voice, rate, pitch } = req.body || {};
      const rawText = typeof text === "string" ? text : "";
      const cleanText = rawText
        .replace(/\[[^\]]{1,40}\]/g, " ")
        .replace(/[*_#`>]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanText) {
        res.status(400).json({ error: "Tekst je neophodan za sintezu govora." });
        return;
      }

      const langKey = String(lang).slice(0, 2).toLowerCase();
      const pair = EDGE_VOICE_BY_LANG[langKey] || EDGE_VOICE_BY_LANG.en;
      const chosenVoice =
        typeof voice === "string" && /^[a-z]{2}-[A-Z]{2,4}-[\w]+Neural$/i.test(voice.trim())
          ? voice.trim()
          : gender === "female"
            ? pair.female
            : pair.male;
      const locale = chosenVoice.match(/^([a-z]{2}-[A-Za-z0-9]{2,4})-/)?.[1] || `${langKey}-US`;
      const rateStr = edgePercentFromValue(rate);
      const pitchStr = edgePercentFromValue(pitch, true);

      const cacheKey = `${chosenVoice}|${rateStr || ""}|${pitchStr || ""}|${cleanText}`;
      let audio = edgeAudioCache.get(cacheKey);

      if (!audio) {
        try {
          audio = await synthesizeEdge(cleanText, chosenVoice, locale, rateStr, pitchStr);
        } catch (edgeErr) {
          console.warn(
            `Edge TTS failed (${chosenVoice}):`,
            edgeErr instanceof Error ? edgeErr.message : edgeErr
          );
          res.status(502).json({
            error: "EDGE_TTS_ERROR",
            message: edgeErr instanceof Error ? edgeErr.message : "Sinteza govora nije uspela.",
          });
          return;
        }

        if (!audio || audio.length === 0) {
          res.status(502).json({ error: "EDGE_TTS_EMPTY" });
          return;
        }

        edgeAudioCache.set(cacheKey, audio);
        if (edgeAudioCache.size > EDGE_CACHE_MAX_ENTRIES) {
          const oldest = edgeAudioCache.keys().next().value;
          if (oldest !== undefined) edgeAudioCache.delete(oldest);
        }
      }

      sendAudioWithRange(req, res, audio);
    } catch (err) {
      console.error("Edge TTS error:", err);
      res.status(500).json({
        error: "EDGE_TTS_ERROR",
        message: err instanceof Error ? err.message : "Greška pri obradi govora.",
      });
    }
  });

  // Universal Natural Speech proxy endpoint (zero-config, high clarity fallback)
  app.post("/api/tts/natural", async (req, res) => {
    try {
      const { text, lang = "sr" } = req.body;
      const rawText = typeof text === "string" ? text : "";
      // Strip any [whispers], [excitedly], etc. emotion tags so Google TTS doesn't attempt to spell them
      const cleanText = rawText
        .replace(/\[\s*(?:whispers|giggles|sarcastically|sighs|laughs|snickers|cries|shouts|yells|clears throat|pause|excitedly|curiously|gently|warmly|softly|calmly|proudly|thoughtfully|enthusiastically|cheerfully|dramatically|seriously|confidently|friendly|lovingly|nervously|relieved|happy|sad|excited|curious|[a-zA-Z]{3,20})\s*\]/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (!cleanText) {
        res.status(400).json({ error: "Tekst je neophodan za sintezu govora." });
        return;
      }

      const langCodeMap: Record<string, string> = {
        sr: "sr",
        hr: "hr",
        bs: "bs",
        en: "en",
        de: "de",
        fr: "fr",
        es: "es",
        it: "it",
        ru: "ru",
        pt: "pt",
        tr: "tr",
      };
      const targetLang = langCodeMap[lang.slice(0, 2).toLowerCase()] || "sr";

      // Split into chunks of max 180 characters by sentence / comma
      const chunks: string[] = [];
      const sentences = cleanText.match(/[^.!?,\n]+[.!?,\n]*|.+/g) || [cleanText];
      let currentChunk = "";

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        if ((currentChunk + " " + trimmed).trim().length <= 180) {
          currentChunk = (currentChunk + " " + trimmed).trim();
        } else {
          if (currentChunk) chunks.push(currentChunk);
          if (trimmed.length > 180) {
            const words = trimmed.split(/\s+/);
            let subChunk = "";
            for (const word of words) {
              if ((subChunk + " " + word).trim().length <= 180) {
                subChunk = (subChunk + " " + word).trim();
              } else {
                if (subChunk) chunks.push(subChunk);
                subChunk = word;
              }
            }
            if (subChunk) currentChunk = subChunk;
            else currentChunk = "";
          } else {
            currentChunk = trimmed;
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      const buffers: Buffer[] = [];
      for (const chunk of chunks.slice(0, 15)) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${targetLang}&client=tw-ob`;
        const ttsRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (ttsRes.ok) {
          const ab = await ttsRes.arrayBuffer();
          buffers.push(Buffer.from(ab));
        }
      }

      if (buffers.length === 0) {
        res.status(500).json({ error: "Sinteza govora nije uspela." });
        return;
      }

      const combined = Buffer.concat(buffers);
      const range = req.headers.range;

      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : combined.length - 1;
        const chunksize = end - start + 1;
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${combined.length}`);
        res.setHeader("Content-Length", chunksize);
        res.send(combined.subarray(start, end + 1));
      } else {
        res.setHeader("Content-Length", combined.length);
        res.send(combined);
      }
    } catch (err) {
      console.error("Natural TTS error:", err);
      res.status(500).json({
        error: "NATURAL_TTS_ERROR",
        message: err instanceof Error ? err.message : "GreĹˇka pri obradi govora.",
      });
    }
  });

  // ElevenLabs Text-to-Speech proxy endpoint using official ElevenLabsClient SDK
  app.post("/api/tts/elevenlabs", async (req, res) => {
    try {
      const headerKey = typeof req.headers["x-elevenlabs-key"] === "string" ? req.headers["x-elevenlabs-key"].trim() : "";
      const bodyKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      const rawKey = headerKey || bodyKey || process.env.ELEVENLABS_API_KEY || "";
      const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

      if (!apiKey) {
        res.status(400).json({
          error: "ELEVENLABS_KEY_MISSING",
          message: "ELEVENLABS_API_KEY nije podeĹˇen na serveru niti prosleÄ‘en u zahtevu.",
        });
        return;
      }

      // Proactive check: Did the user provide a Key ID instead of the secret key?
      if (!apiKey.startsWith("sk_")) {
        res.status(400).json({
          error: "KEY_ID_USED",
          message: "Uneli ste ID kljuÄŤa (Key ID) a ne tajni ElevenLabs API kljuÄŤ. ElevenLabs API kljuÄŤ mora poÄŤinjati sa 'sk_'. Otvorite ElevenLabs profil i kopirajte tajni kljuÄŤ koji poÄŤinje sa 'sk_'.",
          isKeyId: true,
        });
        return;
      }

      const { text, voiceId, modelId, languageCode, voiceSettings: incomingVoiceSettings } = req.body;
      const cleanText = (typeof text === "string" ? text : "").trim();
      if (!cleanText) {
        res.status(400).json({ error: "Tekst je neophodan za sintezu govora." });
        return;
      }

      const targetVoice = voiceId || "NOpBlnGInO9m6vDvFkFC";
      const targetModel = modelId || "eleven_v3";
      const targetLanguageCode = typeof languageCode === "string" && languageCode.trim() ? languageCode.trim() : undefined;

      // Calibration for stable voice with emotions:
      // In ElevenLabs: stability around 0.45 - 0.50 maintains high acoustic consistency (no glitches or voice cracks)
      // while allowing rich emotional expression, tonal inflections, and v3 audio tags ([whispers], [excitedly], etc.)
      const stability = typeof incomingVoiceSettings?.stability === "number"
        ? Math.min(Math.max(incomingVoiceSettings.stability, 0.0), 1.0)
        : 0.50;
      const similarityBoost = typeof incomingVoiceSettings?.similarityBoost === "number"
        ? Math.min(Math.max(incomingVoiceSettings.similarityBoost, 0.0), 1.0)
        : 0.75;
      const style = typeof incomingVoiceSettings?.style === "number"
        ? Math.min(Math.max(incomingVoiceSettings.style, 0.0), 1.0)
        : 0.15;
      const useSpeakerBoost = incomingVoiceSettings?.useSpeakerBoost !== false;

      const elevenlabs = new ElevenLabsClient({ apiKey });

      // Voice settings: v3 primarily modulates stability for expressive speech vs consistency
      // v2 models support stability, similarityBoost, style, and useSpeakerBoost
      const v3VoiceSettings = { stability };
      const v2VoiceSettings = { stability, similarityBoost, style, useSpeakerBoost };

      let audioStream: AsyncIterable<Uint8Array | Buffer>;
      try {
        audioStream = await elevenlabs.textToSpeech.convert(targetVoice, {
          text: cleanText.slice(0, 4000),
          modelId: targetModel,
          languageCode: targetLanguageCode,
          voiceSettings: targetModel === "eleven_v3" ? v3VoiceSettings : v2VoiceSettings,
        }) as AsyncIterable<Uint8Array | Buffer>;
      } catch (convertErr: unknown) {
        // If eleven_v3 is not accessible or languageCode is unsupported, gracefully try eleven_multilingual_v2
        if (targetModel !== "eleven_multilingual_v2") {
          console.warn(`Fallback to eleven_multilingual_v2 for voice ${targetVoice}:`, convertErr instanceof Error ? convertErr.message : convertErr);
          audioStream = await elevenlabs.textToSpeech.convert(targetVoice, {
            text: cleanText.slice(0, 4000),
            modelId: "eleven_multilingual_v2",
            voiceSettings: v2VoiceSettings,
          }) as AsyncIterable<Uint8Array | Buffer>;
        } else {
          throw convertErr;
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(buffer);
    } catch (err: unknown) {
      console.error("ElevenLabs TTS handler error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const isKeyId = errMsg.includes("api_key_id_used_as_api_key") || errMsg.includes("only valid API keys can be used");
      const errWithStatus = err as { statusCode?: number };
      const status = typeof errWithStatus?.statusCode === "number" ? errWithStatus.statusCode : 500;
      res.status(status).json({
        error: isKeyId ? "KEY_ID_USED" : "ELEVENLABS_API_ERROR",
        message: isKeyId
          ? "Uneli ste ID kljuÄŤa (Key ID) a ne tajni API kljuÄŤ. ElevenLabs kljuÄŤ mora poÄŤinjati sa 'sk_'."
          : `ElevenLabs greĹˇka (${status}): ${errMsg}`,
        isKeyId,
      });
    }
  });

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
    return /[0-9]\s*[+\-*/^=]/.test(text) || /[âšâ«â‘Ď€Â˛Âł]/.test(text);
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

    const lines: string[] = ["### đź§® Wolfram Alpha â€” proveren odgovor", ""];

    const answerPod = result.answer
      ? result.pods.find((p) => p.text === result.answer)
      : undefined;

    if (result.answer && answerPod) {
      lines.push(`**âś… Odgovor / Answer:**`, "", "```", result.answer, "```", "");
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
        "5. ANSWERS: For every concrete question, problem or calculation, finish with a clearly labeled final answer line in the student's language, e.g. **âś… Odgovor: ...** (or **âś… Answer: ...** in English), including units and the final value/formula. Show the full derivation BEFORE that line.\n" +
        "6. PROBLEM SOLVING: When given a math, code, or science problem, break down the derivation and solve it completely.";

      if (animalTeacher && typeof animalTeacher === "object") {
        const teacherName = animalTeacher.title || animalTeacher.name || "Animal Teacher";
        const teacherRole = animalTeacher.species || animalTeacher.badge || "Teacher";
        const catchphrase = animalTeacher.catchphraseSr || animalTeacher.catchphrase || "";
        systemInstruction =
          `You are ${teacherName} (${teacherRole}), an adorable, witty, inspiring animal schoolteacher in the student's classroom!\n` +
          `TEACHER PERSONA & CLASSROOM RULES:\n` +
          `1. Speak warmly and authentically in character as this cute animal teacher (${animalTeacher.emoji || "đźľ"}).\n` +
          `2. Your catchphrase: "${catchphrase}".\n` +
          `3. As a true teacher in class: Explain clearly, praise good effort, give constructive tips, and at the end of your message ALWAYS ask the student a thoughtful, engaging question to test what they understood (just like being called to the board in class)!\n` +
          `4. Keep the exact language of the student (Serbian/Croatian/Bosnian if they speak that language, English if English, etc.).\n` +
          `5. Deliver deep, accurate academic explanations without any dumbing down, paired with cute animal charm!\n` +
          `6. Write every formula in LaTeX ($...$ inline, $$...$$ for display) and always end a concrete problem with a bold final answer line such as **âś… Odgovor: ...**.`;
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

      // Gemini unavailable (no key / quota / network) â†’ Wolfram can still answer
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
            diplomaPraise: `ÄŚista petica! ZasluĹľio/la si zvanje pravog malog struÄŤnjaka! đźľ`,
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
