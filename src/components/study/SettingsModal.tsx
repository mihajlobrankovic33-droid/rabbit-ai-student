import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Cpu,
  Download,
  WifiOff,
  HardDriveDownload,
  CheckCircle2,
  AlertCircle,
  Zap,
  Volume2,
  Play,
  Square,
  Check,
  Languages,
  Key,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  AIProvider,
  getSelectedAIProvider,
  setSelectedAIProvider,
} from "@/services/study/aiService";
import {
  IN_BROWSER_MODELS,
  getSavedBrowserModel,
  setSavedBrowserModel,
  getOrInitInBrowserEngine,
  isModelLoadedInBrowser,
  checkWebGPUCapability,
  WebGPUCapability,
} from "@/services/study/webLlmService";
import {
  downloadAppForOffline,
  isAppLocallyCached,
} from "@/services/study/offlineService";
import {
  getVoiceSettings,
  saveVoiceSettings,
  getAvailableVoices,
  speakText,
  stopSpeaking,
  checkServerTTSStatus,
  validateElevenLabsKey,
  getLastTTSError,
  KeyValidationResult,
  ELEVENLABS_VOICES,
  TTSProvider,
  VoiceSettings,
} from "@/services/study/voiceService";
import { useI18n } from "@/services/study/i18n";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<"ai" | "voice" | "offline">("ai");

  // AI Provider state
  const [provider, setProvider] = useState<AIProvider>("in_browser");

  // In-Browser WebLLM state
  const [browserModel, setBrowserModel] = useState<string>(IN_BROWSER_MODELS[0].id);
  const [isDownloadingBrowserModel, setIsDownloadingBrowserModel] = useState(false);
  const [browserModelProgressText, setBrowserModelProgressText] = useState("");
  const [browserModelPercent, setBrowserModelPercent] = useState(0);
  const [isBrowserModelReady, setIsBrowserModelReady] = useState(false);
  const [gpuCapability, setGpuCapability] = useState<WebGPUCapability>({
    supported: true,
    hasShaderF16: false,
  });

  // Voice Settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(getVoiceSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [localElevenKey, setLocalElevenKey] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<KeyValidationResult | null>(null);

  // Offline / SW state
  const [isAppCached, setIsAppCached] = useState(false);
  const [isDownloadingApp, setIsDownloadingApp] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setProvider(getSelectedAIProvider());
      const savedModel = getSavedBrowserModel();
      setBrowserModel(savedModel);
      setIsBrowserModelReady(isModelLoadedInBrowser(savedModel));

      const vSettings = getVoiceSettings();
      setVoiceSettings(vSettings);
      setLocalElevenKey(vSettings.elevenApiKey || "");
      setAvailableVoices(getAvailableVoices());

      checkServerTTSStatus().then((status) => {
        setHasElevenLabsKey(status.hasElevenLabsKey);
      });

      checkWebGPUCapability().then((cap) => {
        setGpuCapability(cap);
        // If current model requires shader-f16 but browser lacks it, switch to universal model
        const currentM = IN_BROWSER_MODELS.find((m) => m.id === savedModel);
        if (currentM?.requiresShaderF16 && !cap.hasShaderF16) {
          const fallback = IN_BROWSER_MODELS.find((m) => !m.requiresShaderF16)?.id || IN_BROWSER_MODELS[0].id;
          setBrowserModel(fallback);
          setSavedBrowserModel(fallback);
        }
      });

      setIsAppCached(isAppLocallyCached());
    } else {
      stopSpeaking();
      setIsTestingVoice(false);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const handleVoices = () => {
        setAvailableVoices(getAvailableVoices());
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoices);
      };
    }
  }, []);

  const handleTestVoice = () => {
    if (isTestingVoice) {
      stopSpeaking();
      setIsTestingVoice(false);
      return;
    }

    const testPhrases: Record<string, string> = {
      sr: "Zdravo! Ja sam tvoj lični profesor i asistent za učenje. Da li me čuješ potpuno jasno i razgovetno?",
      hr: "Pozdrav! Ja sam tvoj osobni profesor i asistent za učenje. Čuješ li me potpuno jasno i razgovijetno?",
      bs: "Zdravo! Ja sam tvoj lični profesor i asistent za učenje. Da li me čuješ potpuno jasno i razgovijetno?",
      en: "Hello! I am your personal study tutor and buddy. Can you hear and understand my voice clearly?",
      de: "Hallo! Ich bin dein persönlicher Lernassistent. Kannst du mich klar und deutlich verstehen?",
      fr: "Bonjour! Je suis ton tuteur d'apprentissage personnel. Est-ce que tu m'entends clairement et distinctement?",
      es: "¡Hola! Soy tu tutor personal de estudio. ¿Puedes escucharme y entenderme con total claridad?",
      it: "Ciao! Sono il tuo tutor personale di studio. Mi senti in modo chiaro e comprensibile?",
      ru: "Привет! Я твой персональный репетитор. Ты слышишь и понимаешь мой голос чётко и разборчиво?",
      pt: "Olá! Eu sou seu tutor pessoal de estudos. Você consegue me ouvir com total clareza?",
      tr: "Merhaba! Ben senin kişisel çalışma öğretmeninim. Sesimi net ve anlaşılır duyabiliyor musun?",
    };

    const phrase = testPhrases[lang] || testPhrases.en;
    setIsTestingVoice(true);
    speakText(phrase, {
      lang,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      preferredVoiceURI: voiceSettings.preferredVoiceURI,
      elevenVoiceId: voiceSettings.elevenVoiceId,
      provider: voiceSettings.provider,
      onEnd: () => {
        setIsTestingVoice(false);
        const lastErr = getLastTTSError();
        if (lastErr && (voiceSettings.provider === "elevenlabs" || voiceSettings.provider === "auto")) {
          if (lastErr.isKeyId) {
            toast.warning("Uneti kod je ID ključa umesto tajnog API ključa (mora počinjati sa 'sk_'). Aktivan je sistemski glas.");
          } else {
            toast.info(`ElevenLabs nije uspeo (${lastErr.message}). Reprodukovan je sistemski glas.`);
          }
        }
      },
      onError: () => setIsTestingVoice(false),
    });
  };

  const handleValidateKey = async () => {
    const keyToTest = localElevenKey.trim();
    if (!keyToTest) {
      toast.warning("Prvo unesite ElevenLabs API ključ za proveru.");
      return;
    }

    if (!keyToTest.startsWith("sk_")) {
      const errRes: KeyValidationResult = {
        valid: false,
        isKeyId: true,
        error: "Uneli ste ID ključa (Key ID) a ne tajni API ključ! ElevenLabs API ključ uvek počinje sa 'sk_'.",
      };
      setKeyValidationResult(errRes);
      toast.error(errRes.error);
      return;
    }

    setIsValidatingKey(true);
    setKeyValidationResult(null);
    try {
      const res = await validateElevenLabsKey(keyToTest);
      setKeyValidationResult(res);
      if (res.valid) {
        toast.success(`ElevenLabs ključ je ispravan! Preostalo: ${(res.remaining ?? 0).toLocaleString()} karaktera (${res.tier || "Free"}).`);
      } else if (res.isKeyId) {
        toast.error("Uneli ste ID ključa umesto tajnog API ključa! Ključ mora počinjati sa 'sk_'.");
      } else {
        toast.error(`Provera nije uspela: ${res.error || "Nevažeći ključ"}`);
      }
    } catch {
      toast.error("Greška pri povezivanju sa serverom za proveru ključa.");
    } finally {
      setIsValidatingKey(false);
    }
  };

  const updateVoiceSettings = (partial: Partial<VoiceSettings>) => {
    const updated = { ...voiceSettings, ...partial };
    setVoiceSettings(updated);
    saveVoiceSettings(updated);
  };

  const handleDownloadInBrowserModel = async () => {
    if (!gpuCapability.supported) {
      toast.error(
        gpuCapability.error || "WebGPU is not enabled in this browser. Using Gemini Cloud AI and Built-in Brain instead."
      );
      setProvider("gemini");
      return;
    }

    setIsDownloadingBrowserModel(true);
    setBrowserModelProgressText("Initializing WebGPU shader pipeline...");
    setBrowserModelPercent(5);

    try {
      await getOrInitInBrowserEngine(browserModel, (report) => {
        setBrowserModelProgressText(report.text);
        if (typeof report.progress === "number" && !isNaN(report.progress)) {
          setBrowserModelPercent(Math.round(report.progress * 100));
        }
      });
      setIsBrowserModelReady(true);
      setSavedBrowserModel(browserModel);
      toast.success("AI Model successfully downloaded into your browser cache!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load model in browser.";
      toast.error(`Download notice: ${msg}. Built-in Brain will assist you automatically!`);
    } finally {
      setIsDownloadingBrowserModel(false);
    }
  };

  const handleDownloadOfflineApp = async () => {
    setIsDownloadingApp(true);
    setDownloadProgress(10);
    try {
      await downloadAppForOffline((percent) => {
        setDownloadProgress(percent);
      });
      setIsAppCached(true);
      toast.success("Study Buddy is now fully cached for 100% offline study!");
    } catch (e: unknown) {
      console.error(e);
      toast.error("Offline download failed. Please try again.");
    } finally {
      setIsDownloadingApp(false);
    }
  };

  const handleSaveAll = () => {
    setSelectedAIProvider(provider);
    setSavedBrowserModel(browserModel);
    saveVoiceSettings(voiceSettings);
    stopSpeaking();
    setIsTestingVoice(false);
    toast.success("Podešavanja su uspešno sačuvana!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Podešavanja & AI Motor</DialogTitle>
              <DialogDescription className="text-xs">
                Podesi AI mozak (WebGPU ili Cloud), kristalno čist glas za ispitivanje i offline keširanje aplikacije.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-muted/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2 font-semibold transition-all ${
              activeTab === "ai"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            In-Browser AI & Modeli
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("voice")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2 font-semibold transition-all ${
              activeTab === "voice"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Volume2 className="h-3.5 w-3.5 text-blue-500" />
            Glas & Izgovor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("offline")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2 font-semibold transition-all ${
              activeTab === "offline"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            Offline Keš
          </button>
        </div>

        {activeTab === "ai" ? (
          <div className="space-y-4 py-1">
            {/* AI Provider selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Choose AI Engine
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {/* 1. Gemini Cloud AI */}
                <button
                  type="button"
                  onClick={() => setProvider("gemini")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "gemini"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">Gemini AI</span>
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      Deep Thinking
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Fastest, most thoughtful AI reasoning across STEM, languages, and deep homework steps.
                  </p>
                </button>

                {/* 2. In-Browser AI */}
                <button
                  type="button"
                  onClick={() => setProvider("in_browser")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "in_browser"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">In-Browser AI</span>
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      WebGPU Tab
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Download & run AI directly inside your browser cache. No terminal required!
                  </p>
                </button>

                {/* 3. Built-in Brain */}
                <button
                  type="button"
                  onClick={() => setProvider("builtin_offline")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "builtin_offline"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">Built-in Brain</span>
                    <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                      Instant 0MB
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Instant offline knowledge engine. Zero download, zero setup required.
                  </p>
                </button>
              </div>
            </div>

            {/* If Gemini is selected */}
            {provider === "gemini" && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-bold">Gemini Deep Thinking AI Active</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Online & Ready
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Study Buddy leverages deep AI reasoning models to break down complex topics step-by-step in any language with complete mathematical derivations, code examples, analogies, and active recall practice.
                </p>
              </div>
            )}

            {/* If In-Browser WebLLM is selected */}
            {provider === "in_browser" && (
              <div className="space-y-3.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Direct In-Browser Model Download (WebGPU)
                    </h3>
                  </div>
                  {isBrowserModelReady ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Model Ready in Tab
                    </span>
                  ) : gpuCapability.supported ? (
                    <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      WebGPU Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" /> WebGPU Unavailable
                    </span>
                  )}
                </div>

                {!gpuCapability.supported ? (
                  <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">WebGPU is not active in this browser tab.</p>
                    <p className="mt-1 text-[11px] opacity-90">
                      Don't worry! <strong>Built-in Brain</strong> is active and answers your questions immediately with full multilingual AI tutoring.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Download lightweight AI models (such as SmolLM2 or Qwen 2.5) directly into your browser storage. Universal models run on all standard WebGPU browsers with zero command line flags!
                  </p>
                )}

                {/* Model Cards */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {IN_BROWSER_MODELS.map((m) => {
                    const isSelected = browserModel === m.id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setBrowserModel(m.id);
                          setIsBrowserModelReady(isModelLoadedInBrowser(m.id));
                        }}
                        className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-card text-foreground ring-1 ring-primary shadow-sm"
                            : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            {m.name}
                            {m.recommended && (
                              <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">
                                Recommended
                              </span>
                            )}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground font-semibold">
                            {m.size}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{m.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Download Progress or Trigger */}
                <div className="pt-1">
                  {isDownloadingBrowserModel ? (
                    <div className="space-y-2 rounded-xl bg-card p-3 border border-border">
                      <div className="flex justify-between text-xs font-semibold text-foreground">
                        <span className="truncate max-w-[80%] text-[11px]">{browserModelProgressText || "Downloading AI weights into browser..."}</span>
                        <span className="text-primary">{browserModelPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${browserModelPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={!gpuCapability.supported}
                      onClick={handleDownloadInBrowserModel}
                      className="w-full gap-2 text-xs font-semibold"
                    >
                      <HardDriveDownload className="h-4 w-4" />
                      {!gpuCapability.supported
                        ? "WebGPU Not Available (Use Gemini AI or Built-in Brain)"
                        : isBrowserModelReady
                        ? "Re-Download / Reload In-Browser Model"
                        : `Download ${IN_BROWSER_MODELS.find((m) => m.id === browserModel)?.name} to Browser`}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* If Built-in Offline is selected */}
            {provider === "builtin_offline" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-bold">Built-in Instant Study Tutor</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Study Buddy includes an educational engine with multilingual comprehension, active recall quizzing, step-by-step math breakdowns, and structured study note templates. It operates 100% in your browser without requiring any software installation or internet connection.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Offline & Service Worker Tab */
          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">Complete Offline App Download</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download and cache the entire web application, user interface, study tools, and service worker.
                  </p>
                </div>
                {isAppCached ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cached for Offline
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <WifiOff className="h-3.5 w-3.5" />
                    Not Cached Yet
                  </span>
                )}
              </div>

              {isDownloadingApp && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Downloading app shell and resources…</span>
                    <span className="font-semibold text-primary">{downloadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleDownloadOfflineApp}
                  disabled={isDownloadingApp}
                  className="w-full gap-2"
                >
                  {isDownloadingApp ? (
                    <>
                      <HardDriveDownload className="h-4 w-4 animate-bounce" />
                      Downloading {downloadProgress}%…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {isAppCached ? "Re-Download & Update Offline Cache" : "Download Whole App for Offline Use"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-xs space-y-2 text-muted-foreground">
              <p className="font-semibold text-foreground">📱 Kako funkcioniše 100% Offline rad:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>
                  <strong className="text-foreground">In-Browser AI:</strong> Modeli se preuzimaju direktno u keš tvog pregledača (WebGPU).
                </li>
                <li>
                  <strong className="text-foreground">Service Worker:</strong> Kešira kompletan korisnički interfejs, CSS, skripte i fontove za rad bez interneta.
                </li>
                <li>
                  <strong className="text-foreground">Lokalna memorija:</strong> Svi tvoji razgovori, beleške i ispitivanja ostaju bezbedno na tvom uređaju.
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="space-y-4 py-1">
            {/* Header / Intro Card */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs">
              <div className="flex items-center gap-2 mb-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                <Volume2 className="h-4 w-4 shrink-0" />
                <span>Multimodalna sinteza glasa — ElevenLabs AI & Sistemski glasovi</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Aplikacija podržava <strong>ElevenLabs AI studio modele</strong> sa realističnim ljudskim disanjem i emocijom, kao i <strong>Edge Natural i sistemske glasove</strong> za 100% offline učenje bez kašnjenja.
              </p>
            </div>

            {/* Voice Provider Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Izbor zvučnog mehanizma (Voice Engine)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: "auto",
                    title: "Automatski (Hibrid)",
                    desc: "ElevenLabs AI kada je dostupan, uz trenutan prelazak na sistemski glas",
                    badge: "Preporučeno",
                  },
                  {
                    id: "elevenlabs",
                    title: "ElevenLabs AI Studio",
                    desc: "Maksimalan realizam, prirodna intonacija i ljudska boja glasa",
                    badge: "Ultra HD",
                  },
                  {
                    id: "browser",
                    title: "Sistemski glas (Offline)",
                    desc: "Lokalno generisanje na tvom uređaju bez upotrebe interneta",
                    badge: "100% Offline",
                  },
                ].map((p) => {
                  const isSelected = voiceSettings.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateVoiceSettings({ provider: p.id as TTSProvider })}
                      className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-xs"
                          : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-foreground">{p.title}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-tight text-muted-foreground">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ElevenLabs Status & Curated Voices */}
            {voiceSettings.provider !== "browser" && (
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-foreground">ElevenLabs AI Studio Glasovi</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasElevenLabsKey ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        API ključ aktivan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" />
                        Koristi sistemski fallback (rezervni)
                      </span>
                    )}
                  </div>
                </div>

                {/* API Key configuration */}
                <div className="rounded-lg border border-border/70 bg-background p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Key className="h-3.5 w-3.5 text-primary" />
                      <span>ElevenLabs API Ključ</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {voiceSettings.elevenApiKey ? "Lokalno sačuvan u pregledaču" : (hasElevenLabsKey ? "Konfigurisan na serveru" : "Nije unesen")}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showElevenKey ? "text" : "password"}
                        value={localElevenKey}
                        onChange={(e) => {
                          setLocalElevenKey(e.target.value);
                          setKeyValidationResult(null);
                        }}
                        placeholder={hasElevenLabsKey && !voiceSettings.elevenApiKey ? "Aktivan ključ sa servera (ELEVENLABS_API_KEY)" : "sk_..."}
                        className={`w-full rounded-lg border bg-card px-3 py-1.5 pr-8 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 ${
                          localElevenKey.trim().length > 0 && !localElevenKey.trim().startsWith("sk_")
                            ? "border-amber-500/80 focus:ring-amber-500 text-amber-900 dark:text-amber-200"
                            : "border-border focus:ring-primary"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowElevenKey(!showElevenKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        title={showElevenKey ? "Sakrij ključ" : "Prikaži ključ"}
                      >
                        {showElevenKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isValidatingKey || !localElevenKey.trim()}
                        onClick={handleValidateKey}
                        className="h-8 text-xs px-2.5 font-medium cursor-pointer"
                        title="Proveri ispravnost ključa na ElevenLabs serveru"
                      >
                        {isValidatingKey ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            <span>Provera...</span>
                          </>
                        ) : (
                          <span>Proveri ključ</span>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          const trimmed = localElevenKey.trim();
                          if (trimmed && !trimmed.startsWith("sk_")) {
                            toast.error("Oprez: Uneti kod je ID ključa, a ne tajni API ključ. ElevenLabs ključ mora počinjati sa 'sk_'.");
                          }
                          updateVoiceSettings({ elevenApiKey: trimmed });
                          if (trimmed) {
                            const isKeyId = !trimmed.startsWith("sk_");
                            setHasElevenLabsKey(!isKeyId);
                            if (!isKeyId) {
                              toast.success("ElevenLabs API ključ je uspešno sačuvan!");
                            } else {
                              toast.warning("Ključ je sačuvan, ali proverite da li počinje sa 'sk_'.");
                            }
                          } else {
                            checkServerTTSStatus().then((s) => setHasElevenLabsKey(s.hasElevenLabsKey));
                            toast.info("Lokalni ključ je uklonjen.");
                          }
                        }}
                        className="h-8 text-xs px-3 font-semibold cursor-pointer"
                      >
                        Sačuvaj
                      </Button>

                      {voiceSettings.elevenApiKey && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setLocalElevenKey("");
                            setKeyValidationResult(null);
                            updateVoiceSettings({ elevenApiKey: "" });
                            checkServerTTSStatus().then((s) => setHasElevenLabsKey(s.hasElevenLabsKey));
                            toast.info("ElevenLabs ključ obrisan iz pregledača.");
                          }}
                          className="h-8 text-xs px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Obriši ključ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Proactive warning when Key ID is detected */}
                  {localElevenKey.trim().length > 0 && !localElevenKey.trim().startsWith("sk_") && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2 text-foreground">
                      <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Kopiran je ID ključa (Key ID), a ne tajni ElevenLabs API ključ!</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ElevenLabs API ključ uvek počinje sa <code className="font-mono font-bold text-foreground bg-background px-1 py-0.5 rounded border border-amber-500/30">sk_</code>. Vrednost koju ste nalepili je identifikator iz kolone <em>Key ID</em>, koji ElevenLabs ne prihvata za autorizaciju.
                      </p>
                      <div className="rounded bg-background/80 p-2 text-[11px] border border-border/70 space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          Kako preuzeti pravi secret key:
                        </span>
                        <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                          <li>
                            Otvori{" "}
                            <a
                              href="https://elevenlabs.io/app/settings/api-keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
                            >
                              ElevenLabs &gt; Developers &gt; API Keys
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>Klikni na dugme <strong>+ Create Key</strong> (ili otkrij postojeći ključ).</li>
                          <li>Kopiraj tajni ključ koji počinje sa <strong>sk_...</strong> i nalepi ga ovde.</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* Validation result feedback badge */}
                  {keyValidationResult && (
                    <div
                      className={`rounded-lg p-2.5 text-xs flex items-center gap-2 border ${
                        keyValidationResult.valid
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300"
                      }`}
                    >
                      {keyValidationResult.valid ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      <div className="flex-1 text-[11px] leading-snug">
                        {keyValidationResult.valid ? (
                          <span>
                            <strong>Ključ je validan i aktivan!</strong> Paket: <strong>{keyValidationResult.tier || "Free"}</strong> • Preostalo za sintezu: <strong>{(keyValidationResult.remaining ?? 0).toLocaleString()}</strong> karaktera.
                          </span>
                        ) : (
                          <span>{keyValidationResult.error || "Provera ključa nije uspela."}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Ključ unet ovde čuva se u tvom pregledaču. Alternativno, možeš ga uneti u postavkama projekta (Settings &gt; Secrets) kao <code className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">ELEVENLABS_API_KEY</code>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Izaberi primarni ElevenLabs glas nastavnika:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ELEVENLABS_VOICES.map((v) => {
                      const isSelected = voiceSettings.elevenVoiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => updateVoiceSettings({ elevenVoiceId: v.id })}
                          className={`cursor-pointer rounded-lg border p-2.5 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-xs"
                              : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {v.name}
                              <span className="text-[10px] font-normal text-muted-foreground">({v.gender === "female" ? "Ženski" : "Muški"})</span>
                            </span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{v.traits}</p>
                          <span className="text-[9px] text-primary/90 font-medium block mt-1">{v.persona}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Test Voice Banner */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5 text-primary" />
                    Testiraj glas za trenutni jezik: <span className="uppercase text-primary font-mono font-bold bg-primary/10 px-1.5 py-0.5 rounded">{lang}</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Klikni na dugme da poslušaš kako izabrani glas izgovara rečenicu.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isTestingVoice ? "destructive" : "default"}
                  onClick={handleTestVoice}
                  className="gap-2 shrink-0 font-semibold shadow-xs"
                >
                  {isTestingVoice ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Zaustavi
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Poslušaj glas
                    </>
                  )}
                </Button>
              </div>

              {isTestingVoice && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary font-medium animate-pulse">
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <span>Govor se reprodukuje... Poslušaj razgovetnost, akcenat i tempo.</span>
                </div>
              )}
            </div>

            {/* Speech Rate (Speed) Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Brzina govora (Speed)
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { value: 0.85, label: "0.85x", desc: "Sporije & Vrlo razgovetno" },
                  { value: 0.95, label: "0.95x", desc: "Preporučeno (Jasno)" },
                  { value: 1.05, label: "1.05x", desc: "Normalan tempo" },
                  { value: 1.2, label: "1.20x", desc: "Brže slušanje" },
                ].map((rateOption) => {
                  const isSelected = Math.abs(voiceSettings.rate - rateOption.value) < 0.05;
                  return (
                    <button
                      key={rateOption.value}
                      type="button"
                      onClick={() => updateVoiceSettings({ rate: rateOption.value })}
                      className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-xs"
                          : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{rateOption.label}</span>
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span className="text-[10px] leading-tight block mt-0.5">{rateOption.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pitch / Tone Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Visina tona glasa (Pitch)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 0.95, label: "0.95x", desc: "Topliji / Dublji ton" },
                  { value: 1.0, label: "1.0x", desc: "Prirodan ljudski glas" },
                  { value: 1.05, label: "1.05x", desc: "Svetliji ton" },
                ].map((pitchOption) => {
                  const isSelected = Math.abs(voiceSettings.pitch - pitchOption.value) < 0.03;
                  return (
                    <button
                      key={pitchOption.value}
                      type="button"
                      onClick={() => updateVoiceSettings({ pitch: pitchOption.value })}
                      className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-xs"
                          : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{pitchOption.label}</span>
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span className="text-[10px] leading-tight block mt-0.5">{pitchOption.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available Voices on device */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Izbor sistemskog glasa uređaja (Fallback / Offline)
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {availableVoices.length > 0 ? `${availableVoices.length} instaliranih glasova` : "Učitavanje..."}
                </span>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-3 space-y-2">
                <select
                  value={voiceSettings.preferredVoiceURI}
                  onChange={(e) => updateVoiceSettings({ preferredVoiceURI: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Automatski (Najčistiji glas za izabrani jezik - Preporučeno)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.localService ? "• Uređaj" : "• Online"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Ako ostaviš na <strong>Automatski</strong>, sistem automatski bira najkvalitetniji glas instaliran na sistemu (Edge Natural, Google Neural, ili Apple Siri).
                </p>
              </div>
            </div>

            {/* Clarity guarantee note */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Pametno čišćenje teksta za maksimalnu razumljivost:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Matematički znakovi (+, -, *, =, %) se automatski pretvaraju u izgovorene reči na izabranom jeziku.</li>
                <li>Uklonjeni su emodžiji, markdown zvezdice i tarabe koji inače zbunjuju govor.</li>
                <li>Tekst se deli na prirodne rečenice kako bi disanje i intonacija zvučali prirodno.</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          <div className="text-[11px] text-muted-foreground">
            Current engine: <span className="font-semibold text-foreground capitalize">{provider.replace("_", " ")}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveAll}>
              Save & Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
