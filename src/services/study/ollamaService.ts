/**
 * Ollama Local AI Service
 * Connects to local Ollama instance with lightweight models (Qwen 0.5B, SmolLM 135M, Llama 3.2 1B, TinyLlama).
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
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read Ollama config:", e);
  }
  return {
    baseUrl: "http://localhost:11434",
    selectedModel: "qwen2.5:0.5b",
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
        : "Cannot reach Ollama at " + cleanUrl + ". Make sure it is running with CORS enabled.",
    };
  }
}

/**
 * Generate chat completion via Ollama `/api/chat`
 */
export async function generateOllamaChat(
  messages: Array<{ role: string; content: string }>,
  config?: Partial<OllamaConfig>
): Promise<string> {
  const currentConfig = { ...getOllamaConfig(), ...config };
  const cleanUrl = currentConfig.baseUrl.replace(/\/+$/, "");

  const systemMessage = {
    role: "system",
    content:
      "You are Study Buddy, an encouraging, friendly, and expert AI tutor. Explain concepts clearly, use structured bullet points and markdown formatting, and answer questions thoroughly for students.",
  };

  const response = await fetch(`${cleanUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: currentConfig.selectedModel || "qwen2.5:0.5b",
      messages: [systemMessage, ...messages],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data?.message?.content || data?.response;
  if (!text) {
    throw new Error("Ollama returned an empty response");
  }
  return text;
}

/**
 * Generate structured study notes via Ollama
 */
export async function generateOllamaNotes(
  title: string,
  topic: string,
  config?: Partial<OllamaConfig>
): Promise<{
  title: string;
  keyPoints: string[];
  summary: string;
  fullNotes?: string;
}> {
  const currentConfig = { ...getOllamaConfig(), ...config };
  const cleanUrl = currentConfig.baseUrl.replace(/\/+$/, "");

  const prompt = `You are an expert educational study assistant.
Create comprehensive study notes for:
Topic Title: ${title}
Specific Details / Subtopics: ${topic}

Respond with valid JSON only in the following format:
{
  "title": "${title}",
  "keyPoints": [
    "Key point 1 explaining core concept",
    "Key point 2 on mechanism or rule",
    "Key point 3 on practical application or formula",
    "Key point 4 active recall review question"
  ],
  "summary": "Concise summary of the key ideas in 2-3 sentences.",
  "fullNotes": "Detailed section-by-section breakdown in markdown."
}`;

  const response = await fetch(`${cleanUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: currentConfig.selectedModel || "qwen2.5:0.5b",
      prompt,
      format: "json",
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama Notes API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.response || "";

  try {
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
    // If JSON parsing fails, return formatted text
    return {
      title,
      keyPoints: [
        `Key overview of ${title}`,
        `Essential concepts in ${topic || title}`,
        `Practice and revision tips`,
      ],
      summary: rawText.slice(0, 300) || `Study notes for ${title}`,
      fullNotes: rawText,
    };
  }
}
