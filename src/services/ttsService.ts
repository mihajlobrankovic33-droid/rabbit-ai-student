import { useState, useEffect } from "react";
import { getVoiceSettings } from "@/services/study/voiceService";

export interface ElevenLabsOptions {
  voiceId?: string;
  modelId?: string;
  apiKey?: string;
  languageCode?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

export interface TTSPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  currentText: string | null;
  currentTitle?: string | null;
  blobUrl: string | null;
  error: string | null;
  source: "elevenlabs" | "natural" | "browser" | null;
}

// In-memory cache of binary buffers to Blob URLs to avoid duplicate API requests
const blobUrlCache: Map<string, { url: string; buffer: ArrayBuffer }> = new Map();

// Active playback state
let currentAudioElement: HTMLAudioElement | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let currentBlobUrl: string | null = null;
let globalAudioCtx: AudioContext | null = null;

let state: TTSPlaybackState = {
  isPlaying: false,
  isLoading: false,
  currentText: null,
  currentTitle: null,
  blobUrl: null,
  error: null,
  source: null,
};

type StateListener = (s: TTSPlaybackState) => void;
const listeners: Set<StateListener> = new Set();

function notifyListeners() {
  const snapshot = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn("TTS listener notification error:", err);
    }
  });
}

function updateState(partial: Partial<TTSPlaybackState>) {
  state = { ...state, ...partial };
  notifyListeners();
}

/**
 * Returns current snapshot of TTS playback state
 */
export function getCurrentPlaybackState(): TTSPlaybackState {
  return { ...state };
}

/**
 * Subscribe to TTS playback state changes
 */
export function subscribeToTTSState(listener: StateListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ensures browser AudioContext is created and resumed on user interaction
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      if (!globalAudioCtx || globalAudioCtx.state === "closed") {
        globalAudioCtx = new AudioCtx();
      }
      if (globalAudioCtx.state === "suspended") {
        globalAudioCtx.resume().catch(() => {});
      }
      return globalAudioCtx;
    }
  } catch {
    // ignore
  }
  return null;
}

export function unlockAudioContext(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// User interaction listeners for autoplay unlocking
if (typeof window !== "undefined") {
  const unlockListener = () => {
    unlockAudioContext();
  };
  window.addEventListener("click", unlockListener, { passive: true });
  window.addEventListener("pointerdown", unlockListener, { passive: true });
  window.addEventListener("touchstart", unlockListener, { passive: true });
  window.addEventListener("keydown", unlockListener, { passive: true });
}

/**
 * Strips bracketed emotion tags like [whispers], [excitedly], etc. for clean spoken reading
 */
export function cleanSpokenText(text: string): string {
  if (!text) return "";
  return text
    .replace(
      /\[\s*(?:whispers|giggles|sarcastically|sighs|laughs|snickers|cries|shouts|yells|clears throat|pause|excitedly|curiously|gently|warmly|softly|calmly|proudly|thoughtfully|enthusiastically|cheerfully|dramatically|seriously|confidently|friendly|lovingly|nervously|relieved|happy|sad|excited|curious|[a-zA-Z]{3,20})\s*\]/gi,
      " "
    )
    .replace(/[#*`_~]/g, "") // remove markdown markup
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Converts a binary ArrayBuffer or Uint8Array into a Blob URL with the specified MIME type.
 * This satisfies the core requirement: converting the binary buffer to a Blob URL.
 */
export function convertBufferToBlobUrl(
  buffer: ArrayBuffer | Uint8Array,
  mimeType: string = "audio/mpeg"
): string {
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Revokes a Blob URL to free browser memory
 */
export function revokeBlobUrl(url: string): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

/**
 * Fetches audio from ElevenLabs (or high-clarity natural server fallback),
 * receives the binary buffer, and converts it to a playable Blob URL.
 */
export async function fetchElevenLabsAudio(
  text: string,
  options?: ElevenLabsOptions
): Promise<{ blobUrl: string; buffer: ArrayBuffer; source: "elevenlabs" | "natural" }> {
  const voiceSettings = getVoiceSettings();

  const voiceId = options?.voiceId || voiceSettings.elevenVoiceId || "NOpBlnGInO9m6vDvFkFC";
  const modelId = options?.modelId || voiceSettings.elevenModelId || "eleven_v3";
  const apiKey = (options?.apiKey || voiceSettings.elevenApiKey || "").trim();
  const stability =
    typeof options?.stability === "number"
      ? options.stability
      : voiceSettings.elevenStability ?? 0.5;
  const similarityBoost =
    typeof options?.similarityBoost === "number"
      ? options.similarityBoost
      : voiceSettings.elevenSimilarityBoost ?? 0.75;
  const style =
    typeof options?.style === "number" ? options.style : voiceSettings.elevenStyle ?? 0.15;
  const useSpeakerBoost = options?.useSpeakerBoost !== false;

  const cacheKey = `tts:${voiceId}:${modelId}:${stability}:${text}`;
  const cached = blobUrlCache.get(cacheKey);
  if (cached) {
    return { blobUrl: cached.url, buffer: cached.buffer, source: "elevenlabs" };
  }

  // 1. Attempt ElevenLabs endpoint if API key looks valid or is configured on server
  let arrayBuffer: ArrayBuffer | null = null;
  let source: "elevenlabs" | "natural" = "elevenlabs";

  // Check if we have a valid ElevenLabs key (must begin with 'sk_')
  const hasClientKey = apiKey.startsWith("sk_");

  if (hasClientKey || !apiKey) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (hasClientKey) {
        headers["x-elevenlabs-key"] = apiKey;
      }

      const res = await fetch("/api/tts/elevenlabs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          voiceId,
          modelId,
          languageCode: options?.languageCode || "sr",
          apiKey: hasClientKey ? apiKey : undefined,
          voiceSettings: {
            stability,
            similarityBoost,
            style,
            useSpeakerBoost,
          },
        }),
      });

      if (res.ok) {
        // Binary buffer received from ElevenLabs
        arrayBuffer = await res.arrayBuffer();
        source = "elevenlabs";
      } else {
        console.warn("ElevenLabs returned non-ok status, falling back to natural server TTS:", res.status);
      }
    } catch (elevenErr) {
      console.warn("ElevenLabs network fetch failed, trying natural fallback:", elevenErr);
    }
  }

  // 2. Fallback to Natural Voice Server (returns binary audio/mpeg buffer)
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    try {
      const cleanText = cleanSpokenText(text);
      const res = await fetch("/api/tts/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText || text,
          lang: options?.languageCode || "sr",
        }),
      });

      if (res.ok) {
        arrayBuffer = await res.arrayBuffer();
        source = "natural";
      }
    } catch (natErr) {
      console.warn("Natural TTS fetch failed:", natErr);
    }
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Neuspešno preuzimanje audio bafera iz ElevenLabs servisa.");
  }

  // Convert binary buffer to Blob URL
  const blobUrl = convertBufferToBlobUrl(arrayBuffer, "audio/mpeg");
  blobUrlCache.set(cacheKey, { url: blobUrl, buffer: arrayBuffer });

  return { blobUrl, buffer: arrayBuffer, source };
}

/**
 * Plays audio from a Blob URL using HTMLAudioElement with Web Audio API fallback.
 */
export async function playAudioFromBlobUrl(
  blobUrl: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
): Promise<HTMLAudioElement> {
  stopPlayback();
  unlockAudioContext();

  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = blobUrl;
      currentAudioElement = audio;
      currentBlobUrl = blobUrl;

      let hasFinished = false;

      audio.onplay = () => {
        callbacks?.onStart?.();
        updateState({ isPlaying: true, isLoading: false, error: null });
      };

      audio.onended = () => {
        if (!hasFinished) {
          hasFinished = true;
          currentAudioElement = null;
          updateState({ isPlaying: false, isLoading: false });
          callbacks?.onEnd?.();
        }
      };

      audio.onerror = (e) => {
        if (!hasFinished) {
          hasFinished = true;
          currentAudioElement = null;
          updateState({
            isPlaying: false,
            isLoading: false,
            error: "Greška tokom reprodukcije zvuka",
          });
          callbacks?.onError?.(e);
          reject(e);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            resolve(audio);
          })
          .catch((playErr) => {
            console.warn("Audio element play error:", playErr);
            if (!hasFinished) {
              hasFinished = true;
              currentAudioElement = null;
              updateState({
                isPlaying: false,
                isLoading: false,
                error: playErr instanceof Error ? playErr.message : "Audio play rejected",
              });
              callbacks?.onError?.(playErr);
              reject(playErr);
            }
          });
      } else {
        resolve(audio);
      }
    } catch (err) {
      updateState({
        isPlaying: false,
        isLoading: false,
        error: err instanceof Error ? err.message : "Inicijalizacija zvuka neuspešna",
      });
      callbacks?.onError?.(err);
      reject(err);
    }
  });
}

/**
 * Main helper to speak text via ElevenLabs.
 * Fetches the binary buffer, converts it to a Blob URL, and plays it.
 */
export async function playSpeech(
  text: string,
  options?: ElevenLabsOptions & { title?: string }
): Promise<{ success: boolean; blobUrl?: string }> {
  const clean = text.trim();
  if (!clean) {
    return { success: false };
  }

  stopPlayback();
  unlockAudioContext();

  updateState({
    isLoading: true,
    isPlaying: false,
    currentText: clean,
    currentTitle: options?.title || null,
    error: null,
  });

  try {
    const { blobUrl, source } = await fetchElevenLabsAudio(clean, options);

    updateState({
      blobUrl,
      source,
    });

    await playAudioFromBlobUrl(blobUrl, {
      onStart: options?.onStart,
      onEnd: () => {
        options?.onEnd?.();
      },
      onError: (err) => {
        options?.onError?.(err);
      },
    });

    return { success: true, blobUrl };
  } catch (err: unknown) {
    console.warn("ElevenLabs TTS playback encountered an issue, trying browser fallback:", err);

    // Fallback: Browser Web Speech API as final fallback
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const spoken = cleanSpokenText(clean);
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = options?.languageCode || "sr";
        utterance.rate = 1.0;

        utterance.onstart = () => {
          options?.onStart?.();
          updateState({ isPlaying: true, isLoading: false, source: "browser", error: null });
        };
        utterance.onend = () => {
          updateState({ isPlaying: false, isLoading: false });
          options?.onEnd?.();
        };
        utterance.onerror = (speechErr) => {
          updateState({ isPlaying: false, isLoading: false, error: "Govorna sinteza neuspešna" });
          options?.onError?.(speechErr);
        };

        window.speechSynthesis.speak(utterance);
        return { success: true };
      } catch (synthErr) {
        console.error("Browser speech fallback failed:", synthErr);
      }
    }

    const errMsg = err instanceof Error ? err.message : "Neuspešna reprodukcija odgovora";
    updateState({
      isLoading: false,
      isPlaying: false,
      error: errMsg,
    });
    options?.onError?.(err);
    return { success: false };
  }
}

export function getCurrentBlobUrl(): string | null {
  return currentBlobUrl;
}

/**
 * Stops all currently active audio playback and speech synthesis
 */
export function stopPlayback(): void {
  currentBlobUrl = null;
  // 1. Stop Web Audio buffer source
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {
      // ignore
    }
    currentSourceNode = null;
  }

  // 2. Stop HTMLAudioElement
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }

  // 3. Stop browser speech synthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  updateState({
    isPlaying: false,
    isLoading: false,
    currentText: null,
    currentTitle: null,
    error: null,
  });
}

/**
 * Check if audio is currently playing
 */
export function isAudioPlaying(): boolean {
  return state.isPlaying;
}

/**
 * React hook to easily bind TTS state and controls inside components like Dashboard
 */
export function useTTSPlayback() {
  const [playbackState, setPlaybackState] = useState<TTSPlaybackState>(getCurrentPlaybackState());

  useEffect(() => {
    const unsubscribe = subscribeToTTSState((nextState) => {
      setPlaybackState(nextState);
    });
    return unsubscribe;
  }, []);

  const play = async (text: string, options?: ElevenLabsOptions & { title?: string }) => {
    return playSpeech(text, options);
  };

  const stop = () => {
    stopPlayback();
  };

  return {
    ...playbackState,
    play,
    stop,
    toggle: (text: string, options?: ElevenLabsOptions & { title?: string }) => {
      if (playbackState.isPlaying && playbackState.currentText === text) {
        stop();
      } else {
        play(text, options);
      }
    },
  };
}
