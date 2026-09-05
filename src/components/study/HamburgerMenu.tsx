import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  Flame,
  Globe,
  GraduationCap,
  HardDriveDownload,
  LogOut,
  MessageSquare,
  Moon,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Sun,
  Laptop,
  Timer,
  Trash2,
  Wifi,
  WifiOff,
  X,
  ShoppingBag,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router";
import {
  COLOR_THEMES,
  ColorTheme,
  applyColorTheme,
  getSavedColorTheme,
} from "@/services/study/themeService";
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  useI18n,
} from "@/services/study/i18n";
import {
  downloadAppForOffline,
  isAppLocallyCached,
} from "@/services/study/offlineService";
import { getSelectedAIProvider } from "@/services/study/aiService";
import type { ChatSession, Note } from "@/types/study";
import { toast } from "sonner";

interface HamburgerMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  // Chat History
  sessions?: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession?: (session: ChatSession) => void;
  onDeleteSession?: (id: string) => void;
  onNewChat?: () => void;
  // Notes & Library
  notes?: Note[];
  onSelectNote?: (note: Note) => void;
  onDeleteNote?: (id: string) => void;
  onOpenNotesTab?: () => void;
  onOpenLibraryTab?: () => void;
  onOpenMarketTab?: () => void;
  // Focus Timer
  timerSeconds?: number;
  timerActive?: boolean;
  timerMode?: "focus" | "break";
  onToggleTimer?: () => void;
  onResetTimer?: () => void;
  onOpenProfile?: () => void;
}

export function HamburgerMenu({
  open,
  onClose,
  onOpenSettings,
  onOpenProfile,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  notes = [],
  onSelectNote,
  onDeleteNote,
  onOpenNotesTab,
  onOpenLibraryTab,
  onOpenMarketTab,
  timerSeconds = 25 * 60,
  timerActive = false,
  timerMode = "focus",
  onToggleTimer,
  onResetTimer,
}: HamburgerMenuProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  const [activeColorTheme, setActiveColorTheme] = useState<ColorTheme>(getSavedColorTheme());
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isCached, setIsCached] = useState(isAppLocallyCached());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleColorChange = (newTheme: ColorTheme) => {
    setActiveColorTheme(newTheme);
    applyColorTheme(newTheme);
    toast.success(`${COLOR_THEMES.find((c) => c.id === newTheme)?.name} theme activated!`);
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLang(newLang);
    const info = SUPPORTED_LANGUAGES.find((l) => l.code === newLang);
    toast.success(`Jezik promenjen na: ${info?.nativeName || newLang}`);
  };

  const handleDownloadOffline = async () => {
    setIsDownloading(true);
    setDownloadProgress(10);
    try {
      await downloadAppForOffline((percent) => {
        setDownloadProgress(percent);
      });
      setIsCached(true);
      toast.success(t("cachedReady"));
    } catch (err: unknown) {
      console.error(err);
      toast.error("Offline sync active via browser cache.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate("/");
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  const currentProvider = getSelectedAIProvider();
  const displayName = user?.name || user?.email || "Student";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-card/98 p-5 sm:p-6 shadow-2xl backdrop-blur-md overflow-y-auto duration-300 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <span className="text-lg">🐰</span>
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground">{t("menu")}</h2>
              <p className="text-[11px] text-muted-foreground">{t("menuDescription")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="mt-5 flex-1 space-y-6">
          {/* 1. CHAT HISTORY (Moved into the hamburger bar as requested) */}
          <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("chatHistory")}
                </h3>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {sessions.length}
                </span>
              </div>
              {onNewChat && (
                <button
                  type="button"
                  onClick={() => {
                    onNewChat();
                    onClose();
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-xl bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary/25 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t("newChat")}</span>
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-center text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">Nema prethodnih razgovora</p>
                <p className="text-[11px]">Sve konverzacije sa AI tutorom se automatski čuvaju ovde.</p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {sessions.map((s) => {
                  const isActive = activeSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                        isActive
                          ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/40"
                          : "border border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:bg-card/80 hover:text-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession?.(s);
                          onClose();
                        }}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {s.title || "Razgovor"}
                        </span>
                      </button>
                      {onDeleteSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(s.id);
                          }}
                          title="Obriši razgovor"
                          className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive hover:scale-110 ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. FOCUS TIMER BANNER (Moved into hamburger bar) */}
          <section className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-background p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {timerMode === "focus" ? t("focusSprint") : t("restBreak")}
                </h3>
              </div>
              <span className="font-mono text-sm font-extrabold text-foreground">
                {formatTimer(timerSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleTimer}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                  timerActive
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
                    : "bg-primary text-primary-foreground shadow-xs"
                }`}
              >
                {timerActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{timerActive ? t("pause") : t("start")}</span>
              </button>
              <button
                type="button"
                onClick={onResetTimer}
                title={t("reset")}
                className="cursor-pointer rounded-xl border border-border/70 bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* 3. SAVED NOTES & LIBRARY BANNER (Moved into hamburger bar) */}
          <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("savedNotes")}
                </h3>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {notes.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {onOpenNotesTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNotesTab();
                      onClose();
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xl bg-card border border-border/70 px-2.5 py-1 text-xs font-bold text-foreground transition-all hover:bg-muted hover:text-primary"
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    <span>Studio</span>
                  </button>
                )}
                {onOpenMarketTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMarketTab();
                      onClose();
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xl bg-card border border-border/70 px-2.5 py-1 text-xs font-bold text-foreground transition-all hover:bg-muted hover:text-primary"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    <span>Market</span>
                  </button>
                )}
                {onOpenLibraryTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLibraryTab();
                      onClose();
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xl bg-card border border-border/70 px-2.5 py-1 text-xs font-bold text-foreground transition-all hover:bg-muted hover:text-primary"
                  >
                    <span>Biblioteka</span>
                  </button>
                )}
              </div>
            </div>

            {notes.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {notes.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-2 text-left text-xs transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectNote?.(n);
                        onClose();
                      }}
                      className="flex min-w-0 flex-1 cursor-pointer items-center justify-between pr-1"
                    >
                      <span className="truncate font-semibold text-[11px] text-foreground">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    {onDeleteNote && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(n.id);
                        }}
                        title="Obriši belešku"
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive hover:scale-110 ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Language Switcher (Serbian, English, and all others) */}
          <section className="space-y-2.5 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("language")}
                </h3>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1 sm:grid-cols-2">
              {SUPPORTED_LANGUAGES.map((l) => {
                const isSelected = lang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageChange(l.code)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? "border border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border border-border/60 bg-card text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{l.flag}</span>
                      <span className="truncate text-[11px]">{l.nativeName}</span>
                    </span>
                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. Theme & Appearance (Mode + Color Palettes) */}
          <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("theme")}
              </h3>
            </div>

            {/* Dark / Light / System mode */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  theme === "light"
                    ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                    : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>{t("light")}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  theme === "dark"
                    ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                    : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>{t("dark")}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  theme === "system"
                    ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                    : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>{t("system")}</span>
              </button>
            </div>

            {/* 6 Color Themes */}
            <div className="pt-2">
              <span className="mb-2 block text-[11px] font-bold text-muted-foreground">
                {t("colorPalette")}:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map((c) => {
                  const isSelected = activeColorTheme === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleColorChange(c.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-2xs"
                          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full shadow-2xs"
                        style={{ backgroundColor: c.previewColor }}
                      />
                      <span className="truncate text-[11px] font-bold">{c.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 6. Offline App Download & Status Banner */}
          <section className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-background p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("offlineDownload")}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Wifi className="h-3 w-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <WifiOff className="h-3 w-3" /> Offline
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("offlineDesc")}
            </p>

            <div className="rounded-xl border border-border/60 bg-background/80 p-3 text-[11px] space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span className="text-muted-foreground">Status keša i modela:</span>
                {isCached ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 100% Spremno
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold">Nije kompletno preuzeto</span>
                )}
              </div>

              {isDownloading && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Preuzimanje fajlova aplikacije...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadOffline}
              className="w-full gap-2 rounded-xl text-xs font-bold shadow-xs"
            >
              {isDownloading ? (
                <>
                  <HardDriveDownload className="h-4 w-4 animate-bounce" />
                  <span>{t("downloading")} ({downloadProgress}%)</span>
                </>
              ) : isCached ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Osveži / Ponovo preuzmi Offline keš</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{t("downloadNow")}</span>
                </>
              )}
            </Button>
          </section>

          {/* 7. AI Engine Settings */}
          <section className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  AI Model Engine
                </h3>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {currentProvider === "gemini"
                  ? "Gemini Flash (Thinking)"
                  : currentProvider === "in_browser"
                  ? "In-Browser WebGPU"
                  : "Built-in Offline"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full gap-2 rounded-xl text-xs font-semibold"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Otvori Detaljna AI Podešavanja & Modele</span>
            </Button>
          </section>
        </div>

        {/* User Profile & Log Out in Hamburger */}
        <div className="mt-6 border-t border-border/60 pt-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 border border-border/60">
            {user?.avatar && !user.avatar.startsWith("data:") && user.avatar.length <= 4 ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl ring-2 ring-primary/25">
                {user.avatar}
              </span>
            ) : user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-primary/25 shadow-xs"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-sm font-black text-primary ring-2 ring-primary/25">
                {initials || "S"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3 text-amber-500" /> {t("activeStudent")}
              </p>
            </div>
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
                className="flex cursor-pointer items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                title="Promeni ime ili profilnu sliku"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Uredi</span>
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={handleSignOut}
            className="w-full gap-2 rounded-xl text-xs font-bold shadow-xs"
          >
            <LogOut className="h-4 w-4" />
            <span>{t("logOut")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
