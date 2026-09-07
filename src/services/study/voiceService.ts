// Comprehensive Multilingual Voice & Speech Service
// Supports ElevenLabs Studio AI voices, Edge Natural voices, and Device Neural speech synthesis

export type TTSProvider = "browser" | "elevenlabs" | "natural" | "auto";

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
  {
    id: "NOpBlnGInO9m6vDvFkFC",
    name: "Zephyros (Eldoria Storyteller)",
    gender: "male",
    traits: "Mudar, ekspresivan, podržava v3 audio tagove i emocije",
    persona: "Preporučeno za priče, v3 ekspresije i slikovita objašnjenja",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George (Topao & Izuzetno Stabilan)",
    gender: "male",
    traits: "Topao, smiren narator, vrhunska stabilnost sa prirodnim emocijama",
    persona: "Preporučeno za stabilan govor sa emocijama i lekcije",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica (Ekspresivna & Stabilna)",
    gender: "female",
    traits: "Jasna, vedra, izražajna dikcija sa živom modulacijom",
    persona: "Odlična za konverzaciju, pitanja i dinamično vođenje",
  },
];

export interface VoiceTheme {
  id: string;
  name: string;
  cleanName: string;
  subtitle: string;
  gender: "female" | "male";
  colorName: string;
  accentHex: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  gradient: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
}

export const VOICE_THEMES: Record<string, VoiceTheme> = {
  "21m00Tcm4TlvDq8ikWAM": {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    cleanName: "Rachel",
    subtitle: "Smirena & Prijatna",
    gender: "female",
    colorName: "Rose",
    accentHex: "#f43f5e",
    textColor: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-500/10 dark:bg-rose-500/20",
    borderColor: "border-rose-500/40",
    ringColor: "ring-rose-400/50",
    gradient: "from-rose-500 to-pink-600",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-700 dark:text-rose-300",
    glow: "shadow-rose-500/20",
  },
  "ErXwobaYiN019PkySvjV": {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    cleanName: "Antoni",
    subtitle: "Energičan & Precizan",
    gender: "male",
    colorName: "Emerald",
    accentHex: "#10b981",
    textColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    ringColor: "ring-emerald-400/50",
    gradient: "from-emerald-500 to-teal-600",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    glow: "shadow-emerald-500/20",
  },
  "pNInz6obpgDQGcFmaJgB": {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    cleanName: "Adam",
    subtitle: "Dubok & Mudar",
    gender: "male",
    colorName: "Blue",
    accentHex: "#3b82f6",
    textColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
    borderColor: "border-blue-500/40",
    ringColor: "ring-blue-400/50",
    gradient: "from-blue-600 to-indigo-600",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-700 dark:text-blue-300",
    glow: "shadow-blue-500/20",
  },
  "EXAVITQu4vr4xnSDxMaL": {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    cleanName: "Bella",
    subtitle: "Izražajna & Motivišuća",
    gender: "female",
    colorName: "Purple",
    accentHex: "#a855f7",
    textColor: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
    borderColor: "border-purple-500/40",
    ringColor: "ring-purple-400/50",
    gradient: "from-purple-500 to-fuchsia-600",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-700 dark:text-purple-300",
    glow: "shadow-purple-500/20",
  },
  "TxGEqnHWrfWFTfGW9XjX": {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    cleanName: "Josh",
    subtitle: "Prirodan Edukator",
    gender: "male",
    colorName: "Amber",
    accentHex: "#f59e0b",
    textColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
    borderColor: "border-amber-500/40",
    ringColor: "ring-amber-400/50",
    gradient: "from-amber-500 to-orange-600",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-700 dark:text-amber-300",
    glow: "shadow-amber-500/20",
  },
  "MF3mGyEYCl7XYWbV9V6O": {
    id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    cleanName: "Elli",
    subtitle: "Nežna & Vedra",
    gender: "female",
    colorName: "Cyan",
    accentHex: "#06b6d4",
    textColor: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10 dark:bg-cyan-500/20",
    borderColor: "border-cyan-500/40",
    ringColor: "ring-cyan-400/50",
    gradient: "from-cyan-500 to-teal-600",
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    glow: "shadow-cyan-500/20",
  },
  "VR6AewLTigWG4xSOukaG": {
    id: "VR6AewLTigWG4xSOukaG",
    name: "Arnold",
    cleanName: "Arnold",
    subtitle: "Fokusiran & Jasan",
    gender: "male",
    colorName: "Ruby",
    accentHex: "#ef4444",
    textColor: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10 dark:bg-red-500/20",
    borderColor: "border-red-500/40",
    ringColor: "ring-red-400/50",
    gradient: "from-red-500 to-rose-600",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-700 dark:text-red-300",
    glow: "shadow-red-500/20",
  },
  "NOpBlnGInO9m6vDvFkFC": {
    id: "NOpBlnGInO9m6vDvFkFC",
    name: "Zephyros",
    cleanName: "Zephyros",
    subtitle: "Eldoria Pripovedač",
    gender: "male",
    colorName: "Violet",
    accentHex: "#8b5cf6",
    textColor: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10 dark:bg-violet-500/20",
    borderColor: "border-violet-500/40",
    ringColor: "ring-violet-400/50",
    gradient: "from-violet-600 to-indigo-700",
    badgeBg: "bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-300",
    glow: "shadow-violet-500/20",
  },
  "JBFqnCBsd6RMkjVDRZzb": {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    cleanName: "George",
    subtitle: "Topao & Stabilan",
    gender: "male",
    colorName: "Orange",
    accentHex: "#ea580c",
    textColor: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10 dark:bg-orange-500/20",
    borderColor: "border-orange-500/40",
    ringColor: "ring-orange-400/50",
    gradient: "from-orange-500 to-amber-600",
    badgeBg: "bg-orange-500/15",
    badgeText: "text-orange-700 dark:text-orange-300",
    glow: "shadow-orange-500/20",
  },
  "cgSgspJ2msm6clMCkdW9": {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica",
    cleanName: "Jessica",
    subtitle: "Ekspresivna & Živa",
    gender: "female",
    colorName: "Fuchsia",
    accentHex: "#d946ef",
    textColor: "text-fuchsia-600 dark:text-fuchsia-400",
    bgColor: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20",
    borderColor: "border-fuchsia-500/40",
    ringColor: "ring-fuchsia-400/50",
    gradient: "from-fuchsia-500 to-pink-600",
    badgeBg: "bg-fuchsia-500/15",
    badgeText: "text-fuchsia-700 dark:text-fuchsia-300",
    glow: "shadow-fuchsia-500/20",
  },
};

export function getVoiceTheme(voiceId?: string): VoiceTheme {
  if (voiceId && VOICE_THEMES[voiceId]) {
    return VOICE_THEMES[voiceId];
  }
  return VOICE_THEMES["21m00Tcm4TlvDq8ikWAM"];
}

export interface VoiceSettings {
  provider: TTSProvider;
  elevenVoiceId: string;
  elevenModelId?: string;
  elevenApiKey?: string;
  elevenStability?: number; // 0.15 - 0.95 (0.50 = optimal sweetspot: stable voice with emotions)
  elevenStyle?: number; // 0.0 - 0.5 (style & emotional intensity)
  elevenSimilarityBoost?: number;
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
      elevenVoiceId: "NOpBlnGInO9m6vDvFkFC",
      elevenModelId: "eleven_v3",
      elevenApiKey: "",
      elevenStability: 0.50,
      elevenStyle: 0.15,
      elevenSimilarityBoost: 0.75,
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
        provider: (parsed.provider === "elevenlabs" || parsed.provider === "browser" || parsed.provider === "auto" || parsed.provider === "natural") ? parsed.provider : "auto",
        elevenVoiceId: typeof parsed.elevenVoiceId === "string" && parsed.elevenVoiceId ? parsed.elevenVoiceId : "NOpBlnGInO9m6vDvFkFC",
        elevenModelId: typeof parsed.elevenModelId === "string" && parsed.elevenModelId ? parsed.elevenModelId : "eleven_v3",
        elevenApiKey: typeof parsed.elevenApiKey === "string" ? parsed.elevenApiKey : "",
        elevenStability: typeof parsed.elevenStability === "number" ? parsed.elevenStability : 0.50,
        elevenStyle: typeof parsed.elevenStyle === "number" ? parsed.elevenStyle : 0.15,
        elevenSimilarityBoost: typeof parsed.elevenSimilarityBoost === "number" ? parsed.elevenSimilarityBoost : 0.75,
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
    elevenVoiceId: "NOpBlnGInO9m6vDvFkFC",
    elevenModelId: "eleven_v3",
    elevenApiKey: "",
    elevenStability: 0.50,
    elevenStyle: 0.15,
    elevenSimilarityBoost: 0.75,
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
    window.dispatchEvent(
      new CustomEvent("study_buddy_voice_changed", { detail: updated })
    );
  } catch (err) {
    console.warn("Failed to save voice settings:", err);
  }
}

export interface ServerTTSStatus {
  hasElevenLabsKey: boolean;
  isServerKeyAnId?: boolean;
  serverKeyLength?: number;
}

// Check server status for ElevenLabs availability
let serverTTSCache: { status: ServerTTSStatus; checkedAt: number } | null = null;
export async function checkServerTTSStatus(): Promise<ServerTTSStatus> {
  const localKey = getVoiceSettings().elevenApiKey?.trim();
  if (localKey) {
    // If user provided an invalid Key ID locally, don't consider it ready
    const isKeyId = !localKey.startsWith("sk_");
    return {
      hasElevenLabsKey: !isKeyId,
      isServerKeyAnId: isKeyId,
      serverKeyLength: localKey.length,
    };
  }

  const now = Date.now();
  if (serverTTSCache && now - serverTTSCache.checkedAt < 10000) {
    return serverTTSCache.status;
  }

  try {
    const res = await fetch("/api/tts/voices");
    if (res.ok) {
      const data = await res.json();
      const status: ServerTTSStatus = {
        hasElevenLabsKey: Boolean(data.hasElevenLabsKey),
        isServerKeyAnId: Boolean(data.isServerKeyAnId),
        serverKeyLength: data.serverKeyLength,
      };
      serverTTSCache = { status, checkedAt: now };
      return status;
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

  // 1. Strip URLs and preserve markdown link text (while leaving [emotion] tags intact)
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]+|[^\s)]+)\)/g, "$1");

  // 2. Strip emojis and pictographs
  cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, "");

  // 3. Strip bold/italic/code markdown (*, _, #, `, ~, >)
  cleaned = cleaned.replace(/[*_#`~>]/g, "");

  // 4. Preserve expressive spoken emotion tags (e.g. [whispers], [giggles], [sarcastically], [excitedly], [chuckles], [gently], [proudly])
  // while removing standalone non-emotion brackets (e.g. citations, numbers [1])
  cleaned = cleaned.replace(/\[(?!\s*(?:whispers|giggles|sarcastically|sighs|laughs|snickers|cries|shouts|yells|clears throat|pause|excitedly|curiously|gently|warmly|softly|calmly|proudly|thoughtfully|enthusiastically|cheerfully|dramatically|seriously|confidently|friendly|lovingly|nervously|relieved|happy|sad|excited|curious|[a-zA-Z]{3,20})\s*\])([^\]]+)\]/gi, "$1");

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
  elevenModelId?: string;
  languageCode?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  provider?: TTSProvider;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function stripEmotionTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[\s*(?:whispers|giggles|sarcastically|sighs|laughs|snickers|cries|shouts|yells|clears throat|pause|excitedly|curiously|gently|warmly|softly|calmly|proudly|thoughtfully|enthusiastically|cheerfully|dramatically|seriously|confidently|friendly|lovingly|nervously|relieved|happy|sad|excited|curious|[a-zA-Z]{3,20})\s*\]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

let keepAliveInterval: number | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
const audioArrayBufferCache: Map<string, ArrayBuffer> = new Map();

// Browser Web Audio API engine for reliable playback without HTMLMediaElement autoplay blocking
let globalAudioCtx: AudioContext | null = null;

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

// User interaction listeners: unlocks AudioContext permanently on first touch/click
if (typeof window !== "undefined") {
  const unlockListener = () => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlockListener, { passive: true });
  window.addEventListener("pointerdown", unlockListener, { passive: true });
  window.addEventListener("touchstart", unlockListener, { passive: true });
  window.addEventListener("keydown", unlockListener, { passive: true });

  // Pre-initialize server key status
  setTimeout(() => {
    checkServerTTSStatus().catch(() => {});
  }, 100);
}

// Play audio buffer through Web Audio API (primary) or HTMLAudioElement (fallback)
async function playAudioArrayBuffer(
  arrayBuffer: ArrayBuffer,
  onEnd?: () => void,
  onError?: (err?: unknown) => void
): Promise<boolean> {
  stopSpeaking();
  unlockAudioContext();

  const ctx = getOrCreateAudioContext();
  if (ctx) {
    try {
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      // decodeAudioData needs an untouched buffer slice
      const copy = arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(copy);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentSourceNode = source;

      let ended = false;
      source.onended = () => {
        if (!ended) {
          ended = true;
          if (currentSourceNode === source) {
            currentSourceNode = null;
          }
          onEnd?.();
        }
      };

      source.start(0);
      return true;
    } catch (decodeErr) {
      console.warn("Web Audio playback failed, falling back to HTMLAudioElement:", decodeErr);
    }
  }

  // Fallback: HTMLAudioElement
  return new Promise((resolve) => {
    try {
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = audioUrl;
      currentAudioElement = audio;

      let hasFinished = false;

      audio.onended = () => {
        if (!hasFinished) {
          hasFinished = true;
          currentAudioElement = null;
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
          resolve(true);
        }
      };

      audio.onerror = (e) => {
        if (!hasFinished) {
          hasFinished = true;
          currentAudioElement = null;
          URL.revokeObjectURL(audioUrl);
          onError?.(e);
          resolve(false);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => resolve(true))
          .catch((err) => {
            console.warn("HTML Audio element play failed:", err);
            if (!hasFinished) {
              hasFinished = true;
              currentAudioElement = null;
              URL.revokeObjectURL(audioUrl);
              onError?.(err);
              resolve(false);
            }
          });
      } else {
        resolve(true);
      }
    } catch (err) {
      console.warn("Audio element initialization error:", err);
      onError?.(err);
      resolve(false);
    }
  });
}

// Check if ElevenLabs is genuinely configured with a valid secret key
export function isElevenLabsKeyValid(): boolean {
  const localKey = getVoiceSettings().elevenApiKey?.trim();
  if (localKey) {
    return localKey.startsWith("sk_");
  }
  if (serverTTSCache?.status) {
    return serverTTSCache.status.hasElevenLabsKey && !serverTTSCache.status.isServerKeyAnId;
  }
  return false;
}

// Helper to play ElevenLabs audio from server
async function speakWithElevenLabs(
  text: string,
  voiceId: string,
  options: SpeakOptions
): Promise<boolean> {
  const vSettings = getVoiceSettings();
  const chosenModel = options.elevenModelId || vSettings.elevenModelId || "eleven_v3";
  const chosenLang = options.languageCode || options.lang || "sr";
  const chosenStability = typeof options.stability === "number" ? options.stability : (vSettings.elevenStability ?? 0.50);
  const chosenStyle = typeof options.style === "number" ? options.style : (vSettings.elevenStyle ?? 0.15);
  const chosenSimilarityBoost = typeof options.similarityBoost === "number" ? options.similarityBoost : (vSettings.elevenSimilarityBoost ?? 0.75);

  const cacheKey = `eleven:${voiceId}:${chosenModel}:${chosenStability.toFixed(2)}:${chosenStyle.toFixed(2)}:${text}`;
  let arrayBuffer = audioArrayBufferCache.get(cacheKey);

  if (!arrayBuffer) {
    const userKey = vSettings.elevenApiKey?.trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (userKey) {
      headers["x-elevenlabs-key"] = userKey;
    }

    try {
      const res = await fetch("/api/tts/elevenlabs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          voiceId,
          modelId: chosenModel,
          languageCode: chosenLang,
          voiceSettings: {
            stability: chosenStability,
            style: chosenStyle,
            similarityBoost: chosenSimilarityBoost,
            useSpeakerBoost: true,
          },
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
        return false;
      }

      clearLastTTSError();
      arrayBuffer = await res.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return false;
      }
      audioArrayBufferCache.set(cacheKey, arrayBuffer);
    } catch (fetchErr) {
      lastTTSError = {
        message: fetchErr instanceof Error ? fetchErr.message : "Mrežna greška sa ElevenLabs",
      };
      return false;
    }
  }

  return playAudioArrayBuffer(arrayBuffer, options.onEnd, options.onError);
}

// High-clarity Natural Server Speech (universal, zero-config, clear Serbian pronunciation)
async function speakWithNaturalTTS(
  text: string,
  lang: string,
  options: SpeakOptions
): Promise<boolean> {
  const cleanSpoken = stripEmotionTags(text);
  if (!cleanSpoken) {
    options.onEnd?.();
    return true;
  }

  const cacheKey = `natural:${lang}:${cleanSpoken}`;
  let arrayBuffer = audioArrayBufferCache.get(cacheKey);

  if (!arrayBuffer) {
    try {
      const res = await fetch("/api/tts/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanSpoken, lang }),
      });

      if (!res.ok) {
        return false;
      }

      arrayBuffer = await res.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return false;
      }
      audioArrayBufferCache.set(cacheKey, arrayBuffer);
    } catch {
      return false;
    }
  }

  return playAudioArrayBuffer(arrayBuffer, options.onEnd, options.onError);
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

  const cleanText = stripEmotionTags(processedText);
  if (!cleanText) {
    options.onEnd?.();
    return () => {};
  }

  const lang = options.lang || "sr";
  const rate = options.rate ?? userSettings.rate ?? 0.95;
  const pitch = options.pitch ?? userSettings.pitch ?? 1.0;
  const preferredVoice = options.preferredVoiceURI ?? userSettings.preferredVoiceURI;

  const utterance = new SpeechSynthesisUtterance(cleanText);
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
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    // Chrome bug prevention: give 40ms breather after cancel before scheduling new utterance
    window.setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
        window.speechSynthesis.resume();
      } catch (e) {
        cleanup();
        options.onError?.(e);
      }
    }, 40);

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

// Master speech trigger: intelligently routes between ElevenLabs, Natural Server TTS, and Browser synthesis
export function speakText(text: string, options: SpeakOptions = {}): () => void {
  unlockAudioContext();
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
    // 1. If provider is "elevenlabs", or "auto" with a verified valid secret key, attempt ElevenLabs AI TTS
    const canAttemptEleven =
      provider === "elevenlabs" ||
      (provider === "auto" && isElevenLabsKeyValid());

    if (canAttemptEleven) {
      try {
        const success = await speakWithElevenLabs(processedText, elevenVoiceId, {
          ...options,
          onEnd: () => {
            if (!cancelled) options.onEnd?.();
          },
          onError: () => {},
        });

        if (success || cancelled) {
          return;
        }
      } catch {
        // Fallback to natural server voice below
      }
    }

    if (cancelled) return;

    // 2. High-clarity Natural Server Speech (works universally across all devices, browsers, and iframes)
    if (provider === "natural" || provider === "auto" || provider === "elevenlabs") {
      try {
        const naturalSuccess = await speakWithNaturalTTS(processedText, lang, {
          ...options,
          onEnd: () => {
            if (!cancelled) options.onEnd?.();
          },
          onError: () => {},
        });

        if (naturalSuccess || cancelled) {
          return;
        }
      } catch {
        // Fallback to browser below
      }
    }

    if (cancelled) return;

    // 3. Browser Web Speech fallback (offline safe)
    speakWithBrowser(processedText, options, userSettings);
  };

  attemptSpeech();

  return () => {
    cancelled = true;
    stopSpeaking();
  };
}

export function stopSpeaking(): void {
  // 1. Stop Web Audio BufferSourceNode
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

  // 3. Stop Browser SpeechSynthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
