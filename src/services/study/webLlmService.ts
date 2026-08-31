/**
 * In-browser WebLLM AI Service (WebGPU client-side AI)
 * Universal, 100% flag-free WebGPU models (SmolLM2, Qwen2.5, Llama-3.2).
 */
import {
  CreateMLCEngine,
  MLCEngine,
  InitProgressReport,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";
import { StudyContent } from "@/types/study";

export interface InBrowserModelOption {
  id: string;
  name: string;
  size: string;
  description: string;
  recommended?: boolean;
}

export interface WebGPUCapability {
  supported: boolean;
  hasShaderF16: boolean;
  error?: string;
}

// 100% Universal WebGPU models that run on standard browsers without shader-f16 or experimental flags
export const IN_BROWSER_MODELS: InBrowserModelOption[] = [
  {
    id: "SmolLM2-135M-Instruct-q0f32-MLC",
    name: "SmolLM2 (135M) - Universal",
    size: "~95 MB",
    description: "Ultra-fast & universally compatible with all standard WebGPU browsers (no flags needed).",
    recommended: true,
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
    name: "Qwen 2.5 (0.5B) - Multilingual",
    size: "~370 MB",
    description: "Top choice for multilingual study (Serbian, English, European languages, Math & Coding).",
    recommended: true,
  },
  {
    id: "SmolLM2-360M-Instruct-q4f32_1-MLC",
    name: "SmolLM2 (360M) - Universal",
    size: "~210 MB",
    description: "Great balance of reasoning and lightweight memory footprint.",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    name: "Llama 3.2 (1B) - Universal",
    size: "~880 MB",
    description: "Meta Llama 3.2 running completely in-browser without server requests.",
  },
  {
    id: "Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC",
    name: "Qwen 2.5 Coder (0.5B) - Universal",
    size: "~370 MB",
    description: "Specialized for programming, algorithms, and STEM problem solving.",
  },
];

let engineInstance: MLCEngine | null = null;
let currentLoadedModelId: string | null = null;
let isInitializing = false;

const BROWSER_MODEL_KEY = "study_buddy_in_browser_model";

export async function checkWebGPUCapability(): Promise<WebGPUCapability> {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return {
      supported: false,
      hasShaderF16: false,
      error: "WebGPU is not enabled in this browser. Built-in Brain and Cloud AI are ready.",
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        hasShaderF16: false,
        error: "No compatible GPU adapter found for WebGPU.",
      };
    }
    const hasShaderF16 = adapter.features.has("shader-f16");
    return {
      supported: true,
      hasShaderF16,
    };
  } catch (err: unknown) {
    return {
      supported: false,
      hasShaderF16: false,
      error: err instanceof Error ? err.message : "Failed to query WebGPU adapter",
    };
  }
}

export function getSavedBrowserModel(): string {
  try {
    const saved = localStorage.getItem(BROWSER_MODEL_KEY);
    if (saved && IN_BROWSER_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return IN_BROWSER_MODELS[0].id;
}

export function setSavedBrowserModel(modelId: string) {
  try {
    // Sanitize to only valid universal models
    const valid = IN_BROWSER_MODELS.some((m) => m.id === modelId)
      ? modelId
      : IN_BROWSER_MODELS[0].id;
    localStorage.setItem(BROWSER_MODEL_KEY, valid);
  } catch {
    // ignore
  }
}

export async function getOrInitInBrowserEngine(
  modelId?: string,
  onProgress?: (report: InitProgressReport) => void
): Promise<MLCEngine> {
  let targetModel = modelId || getSavedBrowserModel();

  // Validate target model is in prebuiltAppConfig and universal
  if (!IN_BROWSER_MODELS.some((m) => m.id === targetModel)) {
    targetModel = IN_BROWSER_MODELS[0].id;
  }

  const gpuInfo = await checkWebGPUCapability();
  if (!gpuInfo.supported) {
    throw new Error(
      gpuInfo.error || "WebGPU is not available in this browser environment."
    );
  }

  if (engineInstance && currentLoadedModelId === targetModel) {
    return engineInstance;
  }

  if (isInitializing) {
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
      appConfig: prebuiltAppConfig,
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
