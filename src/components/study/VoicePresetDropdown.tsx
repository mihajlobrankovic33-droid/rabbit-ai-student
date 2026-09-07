import React, { useState, useEffect, useRef } from "react";
import {
  ELEVENLABS_VOICES,
  CuratedVoice,
  getVoiceSettings,
  saveVoiceSettings,
} from "@/services/study/voiceService";
import { playSpeech, stopPlayback, isAudioPlaying } from "@/services/ttsService";
import {
  Check,
  ChevronDown,
  Loader2,
  Mic,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

interface VoicePresetDropdownProps {
  id?: string;
  className?: string;
  onVoiceChange?: (voice: CuratedVoice) => void;
}

export function VoicePresetDropdown({
  id = "elevenlabs-voice-preset-dropdown",
  className = "",
  onVoiceChange,
}: VoicePresetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    return getVoiceSettings().elevenVoiceId || "21m00Tcm4TlvDq8ikWAM"; // Default to Rachel
  });
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state if voice changes from settings modal or other places
  useEffect(() => {
    const handleVoiceChanged = () => {
      const current = getVoiceSettings().elevenVoiceId;
      if (current) {
        setSelectedVoiceId(current);
      }
    };

    window.addEventListener("study_buddy_voice_changed", handleVoiceChanged);
    return () => {
      window.removeEventListener("study_buddy_voice_changed", handleVoiceChanged);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Find currently selected voice
  const activeVoice =
    ELEVENLABS_VOICES.find((v) => v.id === selectedVoiceId) ||
    ELEVENLABS_VOICES[0]; // Rachel fallback

  const handleSelectVoice = (voice: CuratedVoice) => {
    setSelectedVoiceId(voice.id);
    saveVoiceSettings({
      elevenVoiceId: voice.id,
      provider: "elevenlabs", // ensure ElevenLabs is prioritized
    });

    if (previewingVoiceId) {
      stopPlayback();
      setPreviewingVoiceId(null);
    }

    setIsOpen(false);
    toast.success(`ElevenLabs glas podešen na: ${voice.name}`);
    onVoiceChange?.(voice);
  };

  const handlePreviewVoice = async (e: React.MouseEvent, voice: CuratedVoice) => {
    e.stopPropagation();

    // If currently playing this sample, stop it
    if (previewingVoiceId === voice.id && isAudioPlaying()) {
      stopPlayback();
      setPreviewingVoiceId(null);
      setIsLoadingSample(false);
      return;
    }

    stopPlayback();
    setPreviewingVoiceId(voice.id);
    setIsLoadingSample(true);

    const sampleText = `Zdravo! Ja sam ${voice.name}, tvoj ElevenLabs glas za učenje.`;

    try {
      const res = await playSpeech(sampleText, {
        voiceId: voice.id,
        title: `Uzorak: ${voice.name}`,
        languageCode: "sr",
        onEnd: () => {
          setPreviewingVoiceId(null);
          setIsLoadingSample(false);
        },
        onError: () => {
          setPreviewingVoiceId(null);
          setIsLoadingSample(false);
        },
      });

      setIsLoadingSample(false);
      if (!res.success) {
        setPreviewingVoiceId(null);
      }
    } catch {
      setIsLoadingSample(false);
      setPreviewingVoiceId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className={`relative w-full ${className}`}
    >
      {/* Dropdown Toggle Trigger */}
      <button
        type="button"
        id={`${id}-trigger`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200 cursor-pointer shadow-2xs ${
          isOpen
            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
            : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
            <Mic className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-extrabold text-foreground">
                {activeVoice.name}
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  activeVoice.gender === "female"
                    ? "bg-pink-500/15 text-pink-700 dark:text-pink-300"
                    : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                }`}
              >
                {activeVoice.gender === "female" ? "♀ Ženski" : "♂ Muški"}
              </span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {activeVoice.traits}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="listbox"
          id={`${id}-listbox`}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-border/80 bg-card p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-1"
        >
          <div className="px-2.5 py-1.5 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              ElevenLabs Glasovni Modeli
            </span>
            <span>{ELEVENLABS_VOICES.length} Preseta</span>
          </div>

          {ELEVENLABS_VOICES.map((voice) => {
            const isSelected = voice.id === selectedVoiceId;
            const isPreviewing = previewingVoiceId === voice.id;

            return (
              <div
                key={voice.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectVoice(voice)}
                className={`group flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/40 shadow-2xs"
                    : "hover:bg-muted/70 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}
                  >
                    {voice.name[0]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs truncate">
                        {voice.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-sm font-semibold ${
                          voice.gender === "female"
                            ? "bg-pink-500/10 text-pink-600 dark:text-pink-300"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                        }`}
                      >
                        {voice.gender === "female" ? "Ženski" : "Muški"}
                      </span>
                      {isSelected && (
                        <span className="rounded-md bg-primary/20 px-1.5 py-0.2 text-[9px] font-extrabold text-primary ml-auto">
                          Aktivno
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {voice.traits}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Test Preview Audio Button */}
                  <button
                    type="button"
                    onClick={(e) => handlePreviewVoice(e, voice)}
                    title={`Poslušaj uzorak: ${voice.name}`}
                    className={`cursor-pointer rounded-lg p-1.5 transition-all ${
                      isPreviewing
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "text-muted-foreground hover:bg-primary/15 hover:text-primary"
                    }`}
                  >
                    {isPreviewing && isLoadingSample ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isPreviewing ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0 ml-0.5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
