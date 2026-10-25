// Minimal voice settings service.
// All ElevenLabs / Edge TTS / server-speech synthesis has been removed.
// Only lightweight device preferences (language, rate, pitch) remain.

export type TTSProvider = "browser";

export interface VoiceSettings {
  provider: TTSProvider;
  rate: number; // 0.85 - 1.2
  pitch: number; // 0.9 - 1.1
  preferredVoiceURI: string;
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

const DEFAULT_SETTINGS: VoiceSettings = {
  provider: "browser",
  rate: 0.95,
  pitch: 1.0,
  preferredVoiceURI: "",
};

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: "browser",
        rate: typeof parsed.rate === "number" ? parsed.rate : DEFAULT_SETTINGS.rate,
        pitch: typeof parsed.pitch === "number" ? parsed.pitch : DEFAULT_SETTINGS.pitch,
        preferredVoiceURI:
          typeof parsed.preferredVoiceURI === "string" ? parsed.preferredVoiceURI : "",
      };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveVoiceSettings(settings: Partial<VoiceSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getVoiceSettings();
    const updated = { ...current, ...settings, provider: "browser" as TTSProvider };
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("study_buddy_voice_changed", { detail: updated })
    );
  } catch (err) {
    console.warn("Failed to save voice settings:", err);
  }
}

export function clearLastTTSError(): void {
  // no-op (kept for API compatibility)
}

// Speech synthesis has been removed — this is a no-op so existing call sites
// stay safe while the UI is being cleaned up.
export function speakText(_text: string, options: SpeakOptions = {}): () => void {
  options.onEnd?.();
  return () => {};
}

export function stopSpeaking(): void {
  // no-op
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  preferredVoiceURI?: string;
  languageCode?: string;
  provider?: TTSProvider;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}
