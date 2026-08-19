/**
 * Ollama Local AI Service
 * Connects to local Ollama instance with anti-repetition / anti-suspension parameters
 * and lightweight models (Qwen 0.5B, SmolLM 135M, Llama 3.2 1B, TinyLlama).
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
  maxTokens: number; // default: 800
}

export const RECOMMENDED_LIGHT_MODELS = [
  {
    id: "qwen2.5:0.5b",
    name: "Qwen 2.5 (0.5B)",
    sizeLabel: "~398 MB",
    description: "Recommended lightest: Fast, multilingual, low RAM (<1GB), high accuracy",
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
        maxTokens: typeof parsed.maxTokens === "number" ? parsed.maxTokens : 800,
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
    maxTokens: 800,
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

  // Take the most recent 6 messages
  const recent = messages.slice(-6);

  for (const msg of recent) {
    const trimmed = msg.content.trim();
    if (!trimmed) continue;

    // Avoid passing exact duplicate messages in a row
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
 * Generate chat completion via Ollama `/api/chat` with Anti-Repetition & Anti-Suspension safeguards
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
      "You are Study Buddy, an expert, engaging AI tutor. Give direct, fresh explanations without repeating previous responses. Use markdown formatting with bullet points and bold highlights. Never get stuck repeating phrases or questions.",
  };

  const sanitizedMessages = cleanHistoryForOllama(messages);

  // Use a 30s timeout controller linked to the external signal if provided
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 30000);

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
          // Anti-repetition & Anti-suspension parameters
          temperature: currentConfig.temperature,
          repeat_penalty: currentConfig.repeatPenalty, // Prevents repetitive loops
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

    // Clean up any repeated trailing sentences
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
 * Generate structured study notes via Ollama with anti-repetition protection
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
  fullNotes?: string;
}> {
  const currentConfig = { ...getOllamaConfig(), ...config };
  const cleanUrl = currentConfig.baseUrl.replace(/\/+$/, "");

  const prompt = `You are an expert study assistant.
Generate comprehensive, unique study notes for:
Topic Title: ${title}
Specific Details: ${topic}

Output pure JSON only:
{
  "title": "${title}",
  "keyPoints": [
    "Key mechanism or definition",
    "Essential formula or core rule",
    "Practical real-world application",
    "Active recall review question"
  ],
  "summary": "2-3 sentence summary of the core idea.",
  "fullNotes": "Detailed section breakdown in markdown."
}`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 35000);

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
        format: "json",
        stream: false,
        options: {
          temperature: currentConfig.temperature,
          repeat_penalty: currentConfig.repeatPenalty,
          num_predict: 900,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama Notes HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.response || "";

    const parsed = JSON.parse(rawText);
    return {
      title: parsed.title || title,
      keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
        ? parsed.keyPoints
        : [
            `Core principles of ${title}`,
            `Mechanisms and formulas for ${topic || title}`,
            `Practical study and revision strategies`,
            `Active recall prompt for self-testing`,
          ],
      summary: parsed.summary || `Key study summary for ${title}.`,
      fullNotes: parsed.fullNotes || "",
    };
  } catch {
    clearTimeout(timeoutId);
    if (signal?.aborted) {
      throw new Error("Notes generation stopped.");
    }
    // Return structured breakdown
    return {
      title,
      keyPoints: [
        `Overview of ${title}`,
        `Essential concepts in ${topic || title}`,
        `Practice and revision tips`,
        `Self-quiz recall question for ${title}`,
      ],
      summary: `Comprehensive summary and study guide for ${title}.`,
      fullNotes: `### ${title}\n\nKey study principles for ${topic || title}.`,
    };
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
      // Skip repeated identical line
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
