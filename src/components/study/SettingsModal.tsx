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
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "offline">("ai");

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
    }
  }, [open]);

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
    toast.success("Settings saved successfully!");
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
              <DialogTitle className="text-lg font-bold">AI Models & Offline Settings</DialogTitle>
              <DialogDescription className="text-xs">
                Download and run open-source AI models right inside this website with WebGPU, or use cloud/built-in brains.
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
            In-Browser AI & Models
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
            Offline Cache (PWA)
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
              <p className="font-semibold text-foreground">📱 How 100% Offline Mode Works:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>
                  <strong className="text-foreground">In-Browser AI:</strong> Models like <code>SmolLM2 (135M)</code> or <code>Qwen 2.5 (0.5B)</code> download directly into your browser's WebGPU cache.
                </li>
                <li>
                  <strong className="text-foreground">Service Worker:</strong> Automatically registers in your browser to intercept network requests and deliver cached HTML, CSS, JavaScript, and fonts even in airplane mode.
                </li>
                <li>
                  <strong className="text-foreground">Local Storage:</strong> All chat sessions, past conversations, and saved notes are kept securely in your browser storage.
                </li>
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
