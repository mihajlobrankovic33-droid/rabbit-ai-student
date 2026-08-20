/**
 * Ollama Local AI Service
 * Connects to local Ollama instance with anti-repetition safeguards,
 * multi-language support, and resilient notes parsing.
 */

export interface OllamaModelInfo {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
}

export interface OllamaConfig {
  baseUrl: string; // default: 'http://localhost:11434'
  selectedModel: string; // default: 'qwen2.5:0.5b'
  temperature: number; // default: 0.75
  repeatPenalty: number; // default: 1.30 (breaks repetition loops)
  maxTokens: number; // default: 1000
}

export const RECOMMENDED_LIGHT_MODELS = [
  {
    id: "qwen2.5:0.5b",
    name: "Qwen 2.5 (0.5B)",
    sizeLabel: "~398 MB",
    description: "Recommended lightest: Fast, multilingual, low RAM (<1GB), high accuracy across all subjects",
    command: "ollama run qwen2.5:0.5b",
  },
  {
    id: "smollm:135m",
    name: "SmolLM (135M)",
    sizeLabel: "~140 MB",
    description: "Ultra-tiny: Runs on virtually any device or old laptop with zero lag",
    command: "ollama run smollm:135m",
  },
  {
    id: "llama3.2:1b",
    name: "Llama 3.2 (1B)",
    sizeLabel: "~1.3 GB",
    description: "High quality instruction model with strong reasoning by Meta",
    command: "ollama run llama3.2:1b",
  },
  {
    id: "tinyllama:1.1b",
    name: "TinyLlama (1.1B)",
    sizeLabel: "~638 MB",
    description: "Lightweight classic compact model",
    command: "ollama run tinyllama:1.1b",
  },
  {
    id: "deepseek-r1:1.5b",
    name: "DeepSeek R1 (1.5B)",
    sizeLabel: "~1.1 GB",
    description: "Lightweight math & reasoning model",
    command: "ollama run deepseek-r1:1.5b",
  },
  {
    id: "gemma2:2b",
    name: "Gemma 2 (2B)",
    sizeLabel: "~1.6 GB",
    description: "Google high-performance small model",
    command: "ollama run gemma2:2b",
  },
];

const OLLAMA_CONFIG_KEY = "study_buddy_ollama_config";

export function getOllamaConfig(): OllamaConfig {
  try {
    const raw = localStorage.getItem(OLLAMA_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl: parsed.baseUrl || "http://localhost:11434",
        selectedModel: parsed.selectedModel || "qwen2.5:0.5b",
        temperature: typeof parsed.temperature === "number" ? parsed.temperature : 0.75,
        repeatPenalty: typeof parsed.repeatPenalty === "number" ? parsed.repeatPenalty : 1.3,
        maxTokens: typeof parsed.maxTokens === "number" ? parsed.maxTokens : 1000,
      };
    }
  } catch (e) {
    console.warn("Could not read Ollama config:", e);
  }
  return {
    baseUrl: "http://localhost:11434",
    selectedModel: "qwen2.5:0.5b",
    temperature: 0.75,
    repeatPenalty: 1.3,
    maxTokens: 1000,
  };
}

export function saveOllamaConfig(config: Partial<OllamaConfig>): void {
  try {
    const current = getOllamaConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(OLLAMA_CONFIG_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Could not save Ollama config:", e);
  }
}

/**
 * Check if the local Ollama daemon is reachable and list available models.
 */
export async function checkOllamaConnection(baseUrl: string): Promise<{
  connected: boolean;
  models: OllamaModelInfo[];
  latencyMs: number;
  error?: string;
}> {
  const cleanUrl = baseUrl.replace(/\/+$/, "");
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        connected: false,
        models: [],
        latencyMs: 0,
        error: `Ollama responded with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      connected: true,
      models: Array.isArray(data?.models) ? data.models : [],
      latencyMs,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return {
      connected: false,
      models: [],
      latencyMs: 0,
      error: msg.includes("abort")
        ? "Timeout connecting to Ollama"
        : "Cannot reach Ollama at " + cleanUrl + ". Run: OLLAMA_ORIGINS=\"*\" ollama serve",
    };
  }
}

/**
 * Clean & deduplicate chat history to break repetitive loops before feeding to local model
 */
function cleanHistoryForOllama(
  messages: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];
  const seenContent = new Set<string>();

  const recent = messages.slice(-6);

  for (const msg of recent) {
    const trimmed = msg.content.trim();
    if (!trimmed) continue;

    const key = `${msg.role}:${trimmed.slice(0, 80)}`;
    if (seenContent.has(key)) {
      continue;
    }
    seenContent.add(key);
    result.push({ role: msg.role, content: trimmed });
  }

  return result;
}

/**
 * Generate chat completion via Ollama `/api/chat` with Anti-Repetition & Multi-Language capabilities
 */
export async function generateOllamaChat(
  messages: Array<{ role: string; content: string }>,
  config?: Partial<OllamaConfig>,
  signal?: AbortSignal
): Promise<string> {
  const currentConfig = { ...getOllamaConfig(), ...config };
  const cleanUrl = currentConfig.baseUrl.replace(/\/+$/, "");

  const systemMessage = {
    role: "system",
    content:
      "You are Study Buddy, an expert universal AI tutor. CRITICAL INSTRUCTION: You MUST always respond in the EXACT SAME LANGUAGE as the user's prompt (e.g. Serbian, Bosnian, Croatian, Spanish, German, French, Italian, Russian, English, or any language). Provide accurate, high-quality explanations, formulas, derivations, and study help for ANY academic, technical, or practical subject without restrictions. Avoid repetition.",
  };

  const sanitizedMessages = cleanHistoryForOllama(messages);

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 45000);

  const combinedSignal = signal
    ? createCombinedSignal([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal,
      body: JSON.stringify({
        model: currentConfig.selectedModel || "qwen2.5:0.5b",
        messages: [systemMessage, ...sanitizedMessages],
        stream: false,
        options: {
          temperature: currentConfig.temperature,
          repeat_penalty: currentConfig.repeatPenalty,
          repeat_last_n: 128,
          presence_penalty: 0.7,
          frequency_penalty: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: currentConfig.maxTokens,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    let text = data?.message?.content || data?.response;
    if (!text || typeof text !== "string") {
      throw new Error("Ollama returned an empty response.");
    }

    text = cleanRepeatedTrailingPhrases(text);
    return text;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (signal?.aborted) {
      throw new Error("Generation was stopped by user.");
    }
    throw err;
  }
}

/**
 * Robust extraction of study notes from raw model output (JSON or structured markdown) in any language.
 */
export function parseStudyNotesResponse(
  rawText: string,
  fallbackTitle: string,
  fallbackTopic: string
): {
  title: string;
  keyPoints: string[];
  summary: string;
  fullNotes: string;
} {
  const clean = rawText.trim();
  if (!clean) {
    return {
      title: fallbackTitle,
      keyPoints: [
        fallbackTopic || fallbackTitle,
      ],
      summary: `${fallbackTitle}`,
      fullNotes: `### ${fallbackTitle}\n\n${fallbackTopic}`,
    };
  }

  // 1. Try parsing JSON (direct or inside markdown code fence or braces)
  try {
    let jsonString = clean;
    const jsonBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1].trim();
    } else {
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace < lastBrace) {
        jsonString = clean.substring(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object") {
      const title = String(parsed.title || fallbackTitle).trim();
      const rawPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      const keyPoints = rawPoints.map((p: unknown) => String(p).trim()).filter(Boolean);
      const summary = String(parsed.summary || "").trim();
      const fullNotes = String(parsed.fullNotes || "").trim();

      if (keyPoints.length > 0 || summary || fullNotes) {
        return {
          title: title || fallbackTitle,
          keyPoints: keyPoints.length > 0 ? keyPoints : [summary || title],
          summary: summary || (keyPoints[0] ?? title),
          fullNotes: fullNotes || clean,
        };
      }
    }
  } catch {
    // JSON parsing didn't match, fallback to intelligent markdown extraction
  }

  // 2. Intelligent Markdown / Natural Language section parser
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    // Extract bullets (- , * , • , 1. , 2) , etc.) in any language
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      const pt = bulletMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
      if (pt.length > 3) {
        bullets.push(pt);
      }
    } else if (!line.startsWith("#") && !line.startsWith("```")) {
      if (line.length > 12) {
        paragraphs.push(line);
      }
    }
  }

  const title = fallbackTitle || lines.find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") || "Study Notes";
  const summary = paragraphs.length > 0 ? paragraphs[0] : (bullets[0] || `${title}`);
  const keyPoints = bullets.length >= 2
    ? bullets.slice(0, 8)
    : paragraphs.length >= 2
    ? paragraphs.slice(0, 5)
    : bullets.length > 0
    ? bullets
    : [summary];

  return {
    title,
    keyPoints,
    summary,
    fullNotes: clean,
  };
}

/**
 * Generate structured study notes via Ollama for any subject in any language
 */
export async function generateOllamaNotes(
  title: string,
  topic: string,
  config?: Partial<OllamaConfig>,
  signal?: AbortSignal
): Promise<{
  title: string;
  keyPoints: string[];
  summary: string;
  fullNotes: string;
}> {
  const currentConfig = { ...getOllamaConfig(), ...config };
  const cleanUrl = currentConfig.baseUrl.replace(/\/+$/, "");

  // Flexible prompt that guides the model to answer in the user's language without crashing on rigid schemas
  const prompt = `You are Study Buddy, an expert universal AI tutor.
Generate comprehensive, exam-ready study notes for:
TOPIC: ${title}
DETAILS / SUBTOPICS: ${topic || title}

CRITICAL RULES:
1. LANGUAGE: You MUST write the ENTIRE notes in the EXACT SAME LANGUAGE as the topic title provided above (e.g. if in Serbian/Croatian/Bosnian, write in Serbian/Croatian/Bosnian; if in Spanish, German, French, English, etc., write in that language).
2. ACCURACY: Provide deep, accurate explanations for any subject (STEM, medicine, history, programming, law, languages, etc.) without restriction.
3. STRUCTURE: Include key learning points/mechanisms, a clear summary, and detailed sections with formulas or step-by-step concepts.

You can return JSON or structured markdown:
{
  "title": "${title}",
  "keyPoints": [
    "Key mechanism 1",
    "Key formula / principle 2",
    "Practical application 3",
    "Active recall review question 4"
  ],
  "summary": "Clear summary of the core concept.",
  "fullNotes": "Comprehensive in-depth notes with markdown headings, explanations, and active recall practice."
}`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000);

  const combinedSignal = signal
    ? createCombinedSignal([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${cleanUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal,
      body: JSON.stringify({
        model: currentConfig.selectedModel || "qwen2.5:0.5b",
        prompt,
        stream: false,
        options: {
          temperature: currentConfig.temperature,
          repeat_penalty: currentConfig.repeatPenalty,
          repeat_last_n: 128,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
          num_predict: 1200,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama Notes HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.response || "";

    return parseStudyNotesResponse(rawText, title, topic);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (signal?.aborted) {
      throw new Error("Notes generation stopped.");
    }
    throw err;
  }
}

/**
 * Filter out repeated trailing phrases that small models sometimes generate in loops
 */
function cleanRepeatedTrailingPhrases(text: string): string {
  const lines = text.split("\n");
  const filtered: string[] = [];
  const recentLines = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && recentLines.has(trimmed)) {
      continue;
    }
    if (trimmed.length > 10) {
      recentLines.add(trimmed);
    }
    filtered.push(line);
  }

  return filtered.join("\n");
}

function createCombinedSignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      break;
    }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
