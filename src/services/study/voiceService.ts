// Comprehensive Multilingual Voice & Speech Service
// Supports ElevenLabs Studio AI voices, Edge Natural voices, and Device Neural speech synthesis

export type TTSProvider = "browser" | "elevenlabs" | "auto";

export interface CuratedVoice {
  id: string;
  name: string;
  gender: "female" | "male";
  traits: string;
  persona: string;
}

export const ELEVENLABS_VOICES: CuratedVoice[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    gender: "female",
    traits: "Miran, topao, jasan glas nastavnice",
    persona: "Preporučeno za zeca Lolu i strpljivo učenje",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    gender: "male",
    traits: "Dubok, autoritativan, mudar glas",
    persona: "Preporučeno za pandu Baoa i predavanja",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    gender: "male",
    traits: "Bistar, energičan, precizno artikulisan",
    persona: "Preporučeno za lisca Feliksa i kvizove",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    gender: "female",
    traits: "Izražajna, dinamična, motivišuća",
    persona: "Preporučeno za mačku Micu i dijalog",
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    gender: "male",
    traits: "Prirodan, prijateljski edukator",
    persona: "Odličan za detaljna objašnjenja",
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    gender: "female",
    traits: "Nežna, vedra, kristalno jasna",
    persona: "Odlična za decu i lakše gradivo",
  },
  {
    id: "VR6AewLTigWG4xSOukaG",
    name: "Arnold",
    gender: "male",
    traits: "Fokusiran, jasan govor bez oklevanja",
    persona: "Idealan za definicije i formule",
  },
];

export interface VoiceSettings {
  provider: TTSProvider;
  elevenVoiceId: string;
  elevenApiKey?: string;
  rate: number; // 0.85 - 1.2
  pitch: number; // 0.9 - 1.1
  preferredVoiceURI: string;
  clarityEnhancement: boolean;
}

const VOICE_SETTINGS_KEY = "study_buddy_voice_settings";

export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  sr: "sr-RS",
  hr: "hr-HR",
  bs: "bs-BA",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  ru: "ru-RU",
  pt: "pt-BR",
  tr: "tr-TR",
};

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") {
    return {
      provider: "auto",
      elevenVoiceId: "21m00Tcm4TlvDq8ikWAM",
      elevenApiKey: "",
      rate: 0.95,
      pitch: 1.0,
      preferredVoiceURI: "",
      clarityEnhancement: true,
    };
  }

  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: (parsed.provider === "elevenlabs" || parsed.provider === "browser" || parsed.provider === "auto") ? parsed.provider : "auto",
        elevenVoiceId: typeof parsed.elevenVoiceId === "string" && parsed.elevenVoiceId ? parsed.elevenVoiceId : "21m00Tcm4TlvDq8ikWAM",
        elevenApiKey: typeof parsed.elevenApiKey === "string" ? parsed.elevenApiKey : "",
        rate: typeof parsed.rate === "number" ? parsed.rate : 0.95,
        pitch: typeof parsed.pitch === "number" ? parsed.pitch : 1.0,
        preferredVoiceURI: typeof parsed.preferredVoiceURI === "string" ? parsed.preferredVoiceURI : "",
        clarityEnhancement: parsed.clarityEnhancement !== false,
      };
    }
  } catch {
    // fallback
  }

  return {
    provider: "auto",
    elevenVoiceId: "21m00Tcm4TlvDq8ikWAM",
    elevenApiKey: "",
    rate: 0.95,
    pitch: 1.0,
    preferredVoiceURI: "",
    clarityEnhancement: true,
  };
}

export function saveVoiceSettings(settings: Partial<VoiceSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getVoiceSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save voice settings:", err);
  }
}

// Check server status for ElevenLabs availability
let serverTTSCache: { hasElevenLabsKey: boolean; checkedAt: number } | null = null;
export async function checkServerTTSStatus(): Promise<{ hasElevenLabsKey: boolean }> {
  const localKey = getVoiceSettings().elevenApiKey?.trim();
  if (localKey) {
    // If user provided an invalid Key ID locally, don't consider it ready
    const isKeyId = !localKey.startsWith("sk_");
    return { hasElevenLabsKey: !isKeyId };
  }

  const now = Date.now();
  if (serverTTSCache && now - serverTTSCache.checkedAt < 30000) {
    return { hasElevenLabsKey: serverTTSCache.hasElevenLabsKey };
  }

  try {
    const res = await fetch("/api/tts/voices");
    if (res.ok) {
      const data = await res.json();
      const hasKey = Boolean(data.hasElevenLabsKey);
      serverTTSCache = { hasElevenLabsKey: hasKey, checkedAt: now };
      return { hasElevenLabsKey: hasKey };
    }
  } catch {
    // offline or error
  }
  return { hasElevenLabsKey: false };
}

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
  isKeyId?: boolean;
  tier?: string;
  characterCount?: number;
  characterLimit?: number;
  remaining?: number;
}

export async function validateElevenLabsKey(key?: string): Promise<KeyValidationResult> {
  const targetKey = (key ?? getVoiceSettings().elevenApiKey)?.trim();
  if (!targetKey) {
    return { valid: false, error: "Ključ nije unet." };
  }

  if (!targetKey.startsWith("sk_")) {
    return {
      valid: false,
      isKeyId: true,
      error: "Kopiran je ID ključa (Key ID) a ne tajni ključ. ElevenLabs API ključ mora počinjati sa 'sk_'.",
    };
  }

  try {
    const res = await fetch("/api/tts/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: targetKey }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Neuspešno povezivanje sa serverom.",
    };
  }
}

export interface TTSLastError {
  message: string;
  isKeyId?: boolean;
  code?: string;
}

let lastTTSError: TTSLastError | null = null;
export function getLastTTSError(): TTSLastError | null {
  return lastTTSError;
}
export function clearLastTTSError(): void {
  lastTTSError = null;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices() || [];
}

// Pre-process text to make pronunciation intelligible and natural
export function prepareTextForSpeech(text: string, lang: string = "sr"): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Strip URLs and markdown links
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 2. Strip emojis and pictographs
  cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, "");

  // 3. Strip bold/italic/code markdown
  cleaned = cleaned.replace(/[*_#`~>[\]]/g, "");

  // 4. Translate math symbols to spoken words for high clarity
  const langKey = lang.slice(0, 2).toLowerCase();
  if (langKey === "sr" || langKey === "hr" || langKey === "bs") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*-\s*/g, " minus ")
      .replace(/\s*[*×]\s*/g, " puta ")
      .replace(/\s*[/÷:]\s*(?=\d)/g, " podeljeno sa ")
      .replace(/\s*=\s*/g, " jednako ")
      .replace(/%/g, " posto ")
      .replace(/\^2/g, " na kvadrat ")
      .replace(/\^3/g, " na kub ");
  } else if (langKey === "de") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*-\s*/g, " minus ")
      .replace(/\s*[*×]\s*/g, " mal ")
      .replace(/\s*[/÷]\s*/g, " geteilt durch ")
      .replace(/\s*=\s*/g, " ist gleich ")
      .replace(/%/g, " prozent ");
  } else if (langKey === "fr") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*-\s*/g, " moins ")
      .replace(/\s*[*×]\s*/g, " fois ")
      .replace(/\s*[/÷]\s*/g, " divisé par ")
      .replace(/\s*=\s*/g, " égale ")
      .replace(/%/g, " pour cent ");
  } else if (langKey === "es") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " más ")
      .replace(/\s*-\s*/g, " menos ")
      .replace(/\s*[*×]\s*/g, " por ")
      .replace(/\s*[/÷]\s*/g, " dividido entre ")
      .replace(/\s*=\s*/g, " es igual a ")
      .replace(/%/g, " por ciento ");
  } else if (langKey === "it") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " più ")
      .replace(/\s*-\s*/g, " meno ")
      .replace(/\s*[*×]\s*/g, " per ")
      .replace(/\s*[/÷]\s*/g, " diviso ")
      .replace(/\s*=\s*/g, " uguale a ")
      .replace(/%/g, " per cento ");
  } else if (langKey === "ru") {
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " плюс ")
      .replace(/\s*-\s*/g, " минус ")
      .replace(/\s*[*×]\s*/g, " умножить на ")
      .replace(/\s*[/÷]\s*/g, " разделить на ")
      .replace(/\s*=\s*/g, " равно ")
      .replace(/%/g, " процентов ");
  } else {
    // English default
    cleaned = cleaned
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*-\s*/g, " minus ")
      .replace(/\s*[*×]\s*/g, " times ")
      .replace(/\s*[/÷]\s*/g, " divided by ")
      .replace(/\s*=\s*/g, " equals ")
      .replace(/%/g, " percent ")
      .replace(/\^2/g, " squared ");
  }

  // 5. Clean excess whitespace and multiple punctuation marks
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/!{2,}/g, "!");
  cleaned = cleaned.replace(/\?{2,}/g, "?");

  return cleaned;
}

// Find the best voice in the browser for the target language
export function findBestVoiceForLanguage(
  lang: string,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | undefined {
  const voices = getAvailableVoices();
  if (!voices || voices.length === 0) return undefined;

  if (preferredVoiceURI) {
    const customMatch = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (customMatch) return customMatch;
  }

  const targetLocale = LANGUAGE_LOCALE_MAP[lang] || lang;
  const langPrefix = lang.slice(0, 2).toLowerCase();

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();

    if (vLang === targetLocale.toLowerCase()) {
      score += 100;
    } else if (vLang.startsWith(langPrefix)) {
      score += 60;
    } else {
      return 0;
    }

    if (vName.includes("natural") || vName.includes("neural") || vName.includes("enhanced")) {
      score += 40;
    }
    if (vName.includes("google") || vName.includes("microsoft") || vName.includes("siri") || vName.includes("apple")) {
      score += 20;
    }
    if (v.localService) {
      score += 5;
    }

    return score;
  };

  let bestVoice: SpeechSynthesisVoice | undefined;
  let highestScore = 0;

  for (const voice of voices) {
    const s = scoreVoice(voice);
    if (s > highestScore) {
      highestScore = s;
      bestVoice = voice;
    }
  }

  if (!bestVoice && (langPrefix === "sr" || langPrefix === "hr" || langPrefix === "bs")) {
    bestVoice = voices.find(
      (v) =>
        v.lang.startsWith("sr") ||
        v.lang.startsWith("hr") ||
        v.lang.startsWith("bs") ||
        v.lang.startsWith("sl")
    );
  }

  return bestVoice;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  preferredVoiceURI?: string;
  elevenVoiceId?: string;
  provider?: TTSProvider;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

let keepAliveInterval: number | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
const audioBlobCache: Map<string, string> = new Map();

// Helper to play ElevenLabs audio from server
async function speakWithElevenLabs(
  text: string,
  voiceId: string,
  options: SpeakOptions
): Promise<boolean> {
  const cacheKey = `${voiceId}:${text}`;
  let audioUrl = audioBlobCache.get(cacheKey);

  if (!audioUrl) {
    const userKey = getVoiceSettings().elevenApiKey?.trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (userKey) {
      headers["x-elevenlabs-key"] = userKey;
    }

    const res = await fetch("/api/tts/elevenlabs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        voiceId,
        modelId: "eleven_multilingual_v2",
      }),
    });

    if (!res.ok) {
      try {
        const errJson = await res.json();
        lastTTSError = {
          message: errJson.message || `ElevenLabs greška (${res.status})`,
          isKeyId: Boolean(errJson.isKeyId || errJson.error === "KEY_ID_USED"),
          code: errJson.error,
        };
      } catch {
        lastTTSError = { message: `ElevenLabs greška (${res.status})` };
      }
      return false; // Signals fallback to browser speech
    }

    clearLastTTSError();
    const blob = await res.blob();
    audioUrl = URL.createObjectURL(blob);
    audioBlobCache.set(cacheKey, audioUrl);
  }

  return new Promise((resolve) => {
    try {
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;

      audio.onended = () => {
        currentAudioElement = null;
        options.onEnd?.();
        resolve(true);
      };

      audio.onerror = () => {
        currentAudioElement = null;
        resolve(false);
      };

      audio.play().then(() => {
        resolve(true);
      }).catch(() => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// Browser Web Speech API playback
function speakWithBrowser(
  processedText: string,
  options: SpeakOptions,
  userSettings: VoiceSettings
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onError?.(new Error("Speech synthesis not supported in this browser"));
    return () => {};
  }

  const lang = options.lang || "sr";
  const rate = options.rate ?? userSettings.rate ?? 0.95;
  const pitch = options.pitch ?? userSettings.pitch ?? 1.0;
  const preferredVoice = options.preferredVoiceURI ?? userSettings.preferredVoiceURI;

  const utterance = new SpeechSynthesisUtterance(processedText);
  utterance.rate = Math.max(0.7, Math.min(1.4, rate));
  utterance.pitch = Math.max(0.8, Math.min(1.2, pitch));

  const bestVoice = findBestVoiceForLanguage(lang, preferredVoice);
  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = LANGUAGE_LOCALE_MAP[lang] || lang;
  }

  const cleanup = () => {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };

  utterance.onend = () => {
    cleanup();
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    cleanup();
    options.onError?.(e);
  };

  try {
    window.speechSynthesis.speak(utterance);

    if (typeof window !== "undefined") {
      keepAliveInterval = window.setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          cleanup();
        } else {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }
  } catch (err) {
    cleanup();
    options.onError?.(err);
  }

  return () => {
    stopSpeaking();
  };
}

// Master speech trigger: intelligently routes between ElevenLabs and Browser synthesis
export function speakText(text: string, options: SpeakOptions = {}): () => void {
  stopSpeaking();

  const userSettings = getVoiceSettings();
  const lang = options.lang || "sr";
  const provider = options.provider || userSettings.provider || "auto";
  const elevenVoiceId = options.elevenVoiceId || userSettings.elevenVoiceId || "21m00Tcm4TlvDq8ikWAM";

  const processedText = prepareTextForSpeech(text, lang);
  if (!processedText) {
    options.onEnd?.();
    return () => {};
  }

  let cancelled = false;

  const attemptSpeech = async () => {
    // 1. If provider is elevenlabs or auto, attempt ElevenLabs AI TTS first
    if (provider === "elevenlabs" || provider === "auto") {
      try {
        const success = await speakWithElevenLabs(processedText, elevenVoiceId, {
          ...options,
          onEnd: () => {
            if (!cancelled) options.onEnd?.();
          },
          onError: () => {
            // fallback will be triggered below if not success
          },
        });

        if (success || cancelled) {
          return;
        }
      } catch {
        // Fallback to browser below
      }
    }

    if (cancelled) return;

    // 2. Browser Web Speech fallback (offline safe, zero latency)
    speakWithBrowser(processedText, options, userSettings);
  };

  attemptSpeech();

  return () => {
    cancelled = true;
    stopSpeaking();
  };
}

export function stopSpeaking(): void {
  // 1. Stop HTMLAudioElement
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }

  // 2. Stop Browser SpeechSynthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    window.speechSynthesis.cancel();
  }
}
