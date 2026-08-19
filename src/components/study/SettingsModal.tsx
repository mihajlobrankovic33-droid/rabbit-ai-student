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
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Cpu,
  Download,
  WifiOff,
  Check,
  RefreshCw,
  Copy,
  HardDriveDownload,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import {
  AIProvider,
  getSelectedAIProvider,
  setSelectedAIProvider,
} from "@/services/study/aiService";
import {
  RECOMMENDED_LIGHT_MODELS,
  checkOllamaConnection,
  getOllamaConfig,
  saveOllamaConfig,
  OllamaModelInfo,
} from "@/services/study/ollamaService";
import {
  downloadAppForOffline,
  isAppLocallyCached,
} from "@/services/study/offlineService";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GEMINI_KEY_STORAGE = "study_buddy_gemini_key";

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "offline">("ai");

  // AI Provider state
  const [provider, setProvider] = useState<AIProvider>("builtin_offline");

  // Ollama state
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [selectedModel, setSelectedModel] = useState("qwen2.5:0.5b");
  const [customModel, setCustomModel] = useState("");
  const [repeatPenalty, setRepeatPenalty] = useState(1.3);
  const [temperature, setTemperature] = useState(0.75);

  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{
    tested: boolean;
    connected: boolean;
    latencyMs?: number;
    error?: string;
    models: OllamaModelInfo[];
  }>({
    tested: false,
    connected: false,
    models: [],
  });

  // Gemini state
  const [geminiKey, setGeminiKey] = useState("");

  // Offline / SW state
  const [isAppCached, setIsAppCached] = useState(false);
  const [isDownloadingApp, setIsDownloadingApp] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setProvider(getSelectedAIProvider());
      const ollamaCfg = getOllamaConfig();
      setOllamaUrl(ollamaCfg.baseUrl);
      setSelectedModel(ollamaCfg.selectedModel);
      setRepeatPenalty(ollamaCfg.repeatPenalty || 1.3);
      setTemperature(ollamaCfg.temperature || 0.75);
      setGeminiKey(localStorage.getItem(GEMINI_KEY_STORAGE) || "");
      setIsAppCached(isAppLocallyCached());
    }
  }, [open]);

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    try {
      const result = await checkOllamaConnection(ollamaUrl);
      setOllamaStatus({
        tested: true,
        connected: result.connected,
        latencyMs: result.latencyMs,
        error: result.error,
        models: result.models,
      });
      if (result.connected) {
        toast.success(`Ollama connected! (${result.latencyMs}ms, ${result.models.length} models installed)`);
      } else {
        toast.error("Could not reach Ollama. Check terminal instructions below.");
      }
    } finally {
      setIsTestingOllama(false);
    }
  };

  const handleResetAntiRepetition = () => {
    setRepeatPenalty(1.35);
    setTemperature(0.75);
    toast.success("Anti-loop settings reset to Strong Protection (Penalty: 1.35).");
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

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast.success("Command copied to clipboard!");
  };

  const handleSaveAll = () => {
    setSelectedAIProvider(provider);
    saveOllamaConfig({
      baseUrl: ollamaUrl.trim() || "http://localhost:11434",
      selectedModel: customModel.trim() || selectedModel,
      repeatPenalty: Number(repeatPenalty) || 1.3,
      temperature: Number(temperature) || 0.75,
    });
    if (geminiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, geminiKey.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
    toast.success("Settings saved with Anti-Repetition safeguards!");
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
              <DialogTitle className="text-lg font-bold">AI & Offline Settings</DialogTitle>
              <DialogDescription className="text-xs">
                Configure lightweight offline AI models (Ollama, Built-in) with anti-loop safeguards and Service Worker caching.
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
            AI Model & Ollama
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
            Service Worker & Offline Cache
          </button>
        </div>

        {activeTab === "ai" ? (
          <div className="space-y-4 py-1">
            {/* AI Provider selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select AI Engine
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {/* 1. Ollama */}
                <button
                  type="button"
                  onClick={() => setProvider("ollama")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "ollama"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">Ollama (Local AI)</span>
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Free & Offline
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Runs lightweight models on your laptop without internet with anti-repetition protection.
                  </p>
                </button>

                {/* 2. Built-in Offline Brain */}
                <button
                  type="button"
                  onClick={() => setProvider("builtin_offline")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "builtin_offline"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">Built-in Brain</span>
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      0MB / Instant
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Zero install. Guaranteed to work instantly on any student phone or Chromebook.
                  </p>
                </button>

                {/* 3. Gemini Cloud */}
                <button
                  type="button"
                  onClick={() => setProvider("gemini")}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    provider === "gemini"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">Google Gemini</span>
                    <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                      Cloud
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Cloud API key option for students with internet connection.
                  </p>
                </button>
              </div>
            </div>

            {/* If Ollama is selected */}
            {provider === "ollama" && (
              <div className="space-y-3.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Ollama Configuration & Lightest Models
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestOllama}
                    disabled={isTestingOllama}
                    className="h-7 text-xs gap-1.5 bg-background"
                  >
                    <RefreshCw className={`h-3 w-3 ${isTestingOllama ? "animate-spin" : ""}`} />
                    Test Connection
                  </Button>
                </div>

                {/* Connection Status Banner */}
                {ollamaStatus.tested && (
                  <div
                    className={`rounded-lg p-2.5 text-xs flex items-start gap-2 ${
                      ollamaStatus.connected
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                    }`}
                  >
                    {ollamaStatus.connected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {ollamaStatus.connected
                          ? `Connected to Ollama in ${ollamaStatus.latencyMs}ms`
                          : "Ollama Not Connected"}
                      </p>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        {ollamaStatus.connected
                          ? `Found ${ollamaStatus.models.length} installed model(s) ready for offline study.`
                          : ollamaStatus.error || "Ensure Ollama daemon is running locally."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Anti-Repetition & Anti-Suspension Controls */}
                <div className="rounded-xl border border-border/80 bg-background/80 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <ShieldAlert className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Anti-Repetition & Anti-Loop Safeguards</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetAntiRepetition}
                      className="flex cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset Safeguards</span>
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Repetition Penalty (Breaks spam/loops):</span>
                        <span className="font-bold text-foreground">{repeatPenalty}x</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="1.8"
                        step="0.05"
                        value={repeatPenalty}
                        onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Temperature (Creativity & Variety):</span>
                        <span className="font-bold text-foreground">{temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="1.2"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Host URL */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Ollama Host Endpoint URL
                  </label>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="h-8 text-xs bg-background"
                  />
                </div>

                {/* Recommended Lightest Models */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
                    Recommended Lightest Free Models for Students:
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {RECOMMENDED_LIGHT_MODELS.map((model) => {
                      const isSelected = selectedModel === model.id && !customModel;
                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setCustomModel("");
                          }}
                          className={`cursor-pointer rounded-xl border p-2.5 text-xs transition-all ${
                            isSelected
                              ? "border-primary bg-background shadow-sm ring-1 ring-primary"
                              : "border-border/60 bg-background/50 hover:bg-background"
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-foreground">{model.name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {model.sizeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                            {model.description}
                          </p>
                          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5">
                            <code className="text-[10px] text-muted-foreground truncate">{model.command}</code>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCommand(model.command);
                              }}
                              title="Copy install command"
                              className="cursor-pointer rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Model Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Or Use Custom Model Name (if already downloaded in Ollama):
                  </label>
                  <Input
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value);
                    }}
                    placeholder="e.g. mistral, phi3, deepseek-coder:1.3b..."
                    className="h-8 text-xs bg-background"
                  />
                </div>

                {/* Student Quick Setup Help */}
                <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-foreground">💡 Quick 1-Minute Student Setup for Ollama:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-muted-foreground text-[11px]">
                    <li>
                      Install free Ollama from{" "}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        ollama.com
                      </a>
                    </li>
                    <li>
                      Download the lightest model in your terminal:
                      <div className="mt-1 flex items-center justify-between rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground">
                        <span>ollama run qwen2.5:0.5b</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand("ollama run qwen2.5:0.5b")}
                          className="cursor-pointer text-primary hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </li>
                    <li>
                      If running from a browser origin, enable web access with:
                      <div className="mt-1 flex items-center justify-between rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground">
                        <span>OLLAMA_ORIGINS="*" ollama serve</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand('OLLAMA_ORIGINS="*" ollama serve')}
                          className="cursor-pointer text-primary hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* If Built-in Offline is selected */}
            {provider === "builtin_offline" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-bold">Built-in Offline Study Assistant (Ready Instantly)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Study Buddy includes a zero-overhead educational brain with multilingual topic comprehension, active recall quizzing, step-by-step math breakdowns, and structured study note templates. It operates 100% in your browser without requiring any software installation or internet connection.
                </p>
              </div>
            )}

            {/* If Gemini is selected */}
            {provider === "gemini" && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4 text-xs">
                <label className="flex items-center justify-between font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Google Gemini API Key</span>
                  {geminiKey && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                      <Check className="h-3 w-3" /> Key active
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
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
                  <strong className="text-foreground">Service Worker:</strong> Automatically registers in your browser to intercept network requests and deliver cached HTML, CSS, JavaScript, and fonts even in airplane mode.
                </li>
                <li>
                  <strong className="text-foreground">Offline AI Models:</strong> Pair this with Ollama (e.g. <code>qwen2.5:0.5b</code> or <code>smollm:135m</code>) or the Built-in Brain to chat and generate notes with zero internet.
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
            Current mode: <span className="font-semibold text-foreground capitalize">{provider.replace("_", " ")}</span>
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
