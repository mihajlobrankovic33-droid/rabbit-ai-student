/**
 * In-browser WebLLM AI Service (WebGPU client-side AI)
 * Allows downloading and running models (SmolLM2, Qwen2.5, Llama-3.2) directly inside the browser.
 */
import { CreateMLCEngine, MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";
import { StudyContent } from "@/types/study";

export interface InBrowserModelOption {
  id: string;
  name: string;
  size: string;
  description: string;
  recommended?: boolean;
}

export const IN_BROWSER_MODELS: InBrowserModelOption[] = [
  {
    id: "SmolLM2-135M-Instruct-q0f16-MLC",
    name: "SmolLM2 (135M)",
    size: "~90 MB",
    description: "Ultra-fast & ultra-lightweight. Downloads in seconds, works on almost any device.",
    recommended: true,
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 (360M)",
    size: "~200 MB",
    description: "Great balance of speed and knowledge for rapid revision and study notes.",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 (0.5B)",
    size: "~350 MB",
    description: "Excellent multilingual capabilities (Serbian, English, European languages, Math & Code).",
    recommended: true,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 (1B)",
    size: "~880 MB",
    description: "Deep reasoning and extensive academic depth (Meta Llama 3.2).",
  },
];

let engineInstance: MLCEngine | null = null;
let currentLoadedModelId: string | null = null;
let isInitializing = false;

const BROWSER_MODEL_KEY = "study_buddy_in_browser_model";

export function getSavedBrowserModel(): string {
  try {
    return localStorage.getItem(BROWSER_MODEL_KEY) || IN_BROWSER_MODELS[0].id;
  } catch {
    return IN_BROWSER_MODELS[0].id;
  }
}

export function setSavedBrowserModel(modelId: string) {
  try {
    localStorage.setItem(BROWSER_MODEL_KEY, modelId);
  } catch {
    // ignore
  }
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function getOrInitInBrowserEngine(
  modelId?: string,
  onProgress?: (report: InitProgressReport) => void
): Promise<MLCEngine> {
  const targetModel = modelId || getSavedBrowserModel();

  if (engineInstance && currentLoadedModelId === targetModel) {
    return engineInstance;
  }

  if (isInitializing) {
    // Wait for in-progress load
    while (isInitializing) {
      await new Promise((res) => setTimeout(res, 200));
    }
    if (engineInstance && currentLoadedModelId === targetModel) {
      return engineInstance;
    }
  }

  isInitializing = true;
  try {
    const engine = await CreateMLCEngine(targetModel, {
      initProgressCallback: (report) => {
        if (onProgress) onProgress(report);
      },
    });

    engineInstance = engine;
    currentLoadedModelId = targetModel;
    setSavedBrowserModel(targetModel);
    return engineInstance;
  } finally {
    isInitializing = false;
  }
}

export function getLoadedInBrowserModel(): string | null {
  return currentLoadedModelId;
}

export function isModelLoadedInBrowser(modelId?: string): boolean {
  if (!modelId) return engineInstance !== null;
  return engineInstance !== null && currentLoadedModelId === modelId;
}

export async function generateInBrowserChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  modelId?: string,
  onProgress?: (report: InitProgressReport) => void,
  signal?: AbortSignal
): Promise<string> {
  const engine = await getOrInitInBrowserEngine(modelId, onProgress);

  if (signal?.aborted) throw new Error("Aborted");

  const systemMessage = {
    role: "system" as const,
    content:
      "You are Study Buddy, a helpful, intelligent 24/7 AI tutor. " +
      "CRITICAL: Always answer in the exact same language as the student's question (e.g. Serbian, Croatian, English, German, Spanish, etc.). " +
      "Provide clear explanations, step-by-step instructions, and bold key terms.",
  };

  const formatted = [
    systemMessage,
    ...messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
  ];

  const reply = await engine.chat.completions.create({
    messages: formatted,
    temperature: 0.7,
    max_tokens: 1024,
  });

  return reply.choices[0]?.message?.content || "";
}

export async function generateInBrowserStudyNotes(
  title: string,
  topic: string,
  modelId?: string,
  onProgress?: (report: InitProgressReport) => void,
  signal?: AbortSignal
): Promise<StudyContent> {
  const engine = await getOrInitInBrowserEngine(modelId, onProgress);

  if (signal?.aborted) throw new Error("Aborted");

  const prompt = `Generate comprehensive, exam-ready study notes on this topic:
Title: ${title}
Details: ${topic}

CRITICAL: Respond in the EXACT SAME LANGUAGE as the Title/Details above (e.g. Serbian if in Serbian, English if in English).
Provide:
1. Short Summary (2-3 sentences)
2. 4-5 Key Takeaways & Core Rules
3. In-Depth Step-by-Step Explanation & Real-World Application
4. 2 Active Recall Review Questions`;

  const reply = await engine.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are an expert universal study tutor. Respond in the exact language requested.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 1200,
  });

  const text = reply.choices[0]?.message?.content || "";

  return {
    title: title || "Study Notes",
    keyPoints: [
      `Core principle and mechanisms for ${title}`,
      `Practical step-by-step execution`,
      "Common misconceptions to avoid",
      "Active recall self-test",
    ],
    summary: `${title}: Comprehensive study guide.`,
    fullNotes: text || `### ${title}\n\n${topic}`,
  };
}
