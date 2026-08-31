import React, { useCallback, useEffect, useState } from "react";
import { ChatView } from "@/components/study/ChatView";
import { GenerateForm } from "@/components/study/GenerateForm";
import { GeneratedContent } from "@/components/study/GeneratedContent";
import { MarketView } from "@/components/study/MarketView";
import { RabbitLogo } from "@/components/study/RabbitLogo";
import { SettingsModal } from "@/components/study/SettingsModal";
import { HamburgerMenu } from "@/components/study/HamburgerMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useStudyAI } from "@/hooks/use-study-ai";
import { useI18n, SUPPORTED_LANGUAGES } from "@/services/study/i18n";
import {
  deleteChatSession,
  deleteNote,
  getChatSessions,
  getNotes,
  saveChatSession,
  saveNote,
} from "@/services/study/notesService";
import { getSelectedAIProvider } from "@/services/study/aiService";
import { getOllamaConfig } from "@/services/study/ollamaService";
import type { ChatMessage, ChatSession, Note, StudyContent } from "@/types/study";
import {
  BookOpen,
  Cpu,
  Flame,
  GraduationCap,
  Menu,
  MessageSquare,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { generateNotes } = useStudyAI();
  const { lang, t } = useI18n();

  const [activeView, setActiveView] = useState<"chat" | "notes" | "market" | "library">("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  // Pomodoro Focus Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState({ provider: "builtin_offline", model: "" });

  // Notes state - scoped to active student
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentContent, setCurrentContent] = useState<StudyContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");

  // Chat state - scoped to active student
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [chatKey, setChatKey] = useState(`chat-${Date.now()}`);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load chat sessions and notes strictly for the logged-in student
  const currentUserId = user?.id || "default_student";

  useEffect(() => {
    setNotes(getNotes(currentUserId));
    setSessions(getChatSessions(currentUserId));
    const prov = getSelectedAIProvider();
    const ollama = getOllamaConfig();
    setProviderInfo({
      provider: prov,
      model:
        prov === "ollama"
          ? `Ollama (${ollama.selectedModel})`
          : prov === "gemini"
          ? "Gemini Flash Thinking"
          : prov === "in_browser"
          ? "In-Browser WebGPU"
          : "Built-in Brain",
    });
  }, [currentUserId, settingsOpen]);

  // Pomodoro Timer Tick Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      if (timerMode === "focus") {
        toast.success("Odličan posao! 25m Fokus sprint završen. Uzmi pauzu 5m! ☕");
        setTimerMode("break");
        setTimerSeconds(5 * 60);
      } else {
        toast.info("Pauza završena! Spreman za novu sesiju učenja? 🐰📚");
        setTimerMode("focus");
        setTimerSeconds(25 * 60);
      }
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds, timerMode]);

  const toggleTimer = useCallback(() => {
    setTimerActive((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setTimerActive(false);
    setTimerSeconds(timerMode === "focus" ? 25 * 60 : 5 * 60);
  }, [timerMode]);

  const refreshNotes = useCallback(() => setNotes(getNotes(currentUserId)), [currentUserId]);
  const refreshSessions = useCallback(() => setSessions(getChatSessions(currentUserId)), [currentUserId]);

  const handleGenerate = useCallback(
    async (title: string, topic: string) => {
      setIsGenerating(true);
      setIsSaved(false);
      setActiveNoteId(null);
      setCurrentTitle(title);
      setCurrentTopic(topic);

      try {
        const content = await generateNotes(title, topic);
        setCurrentContent(content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Neuspešno generisanje";
        toast.error(msg);
      } finally {
        setIsGenerating(false);
      }
    },
    [generateNotes]
  );

  const handleSave = useCallback(() => {
    if (!currentContent) return;

    const noteToSave: Note = {
      id: activeNoteId ?? makeId(),
      title: currentTitle || "Beleške bez naslova",
      topic: currentTopic,
      content: currentContent,
      userId: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveNote(noteToSave, currentUserId);
    setActiveNoteId(noteToSave.id);
    setIsSaved(true);
    refreshNotes();
    toast.success("Beleške uspešno sačuvane u biblioteku!");
  }, [activeNoteId, currentContent, currentTitle, currentTopic, currentUserId, refreshNotes]);

  const handleSelectNote = useCallback((note: Note) => {
    setActiveNoteId(note.id);
    setCurrentTitle(note.title);
    setCurrentTopic(note.topic);
    setCurrentContent(note.content);
    setIsSaved(true);
    setActiveView("notes");
  }, []);

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote(id, currentUserId);
      refreshNotes();
      if (activeNoteId === id) {
        setActiveNoteId(null);
        setCurrentContent(null);
        setIsSaved(false);
      }
      toast("Beleška obrisana");
    },
    [activeNoteId, currentUserId, refreshNotes]
  );

  const handleSaveSession = useCallback(
    (messages: ChatMessage[]) => {
      if (messages.length === 0) return;
      const id = activeSessionId ?? `chat-${Date.now()}`;
      const session: ChatSession = {
        id,
        title: messages[0].content.slice(0, 40) || "Chat sesija",
        messages,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
      };
      saveChatSession(session, currentUserId);
      setActiveSessionId(id);
      refreshSessions();
    },
    [activeSessionId, currentUserId, refreshSessions]
  );

  const handleSelectSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setInitialMessages(session.messages);
    setChatKey(session.id);
    setActiveView("chat");
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setInitialMessages([]);
    setChatKey(`chat-${Date.now()}`);
    setActiveView("chat");
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteChatSession(id, currentUserId);
      refreshSessions();
      if (activeSessionId === id) handleNewChat();
      toast("Razgovor obrisan");
    },
    [activeSessionId, currentUserId, handleNewChat, refreshSessions]
  );

  const displayName = user?.name || user?.email || "Student";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const currentLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary flex flex-col">
      {/* Top Header Bar: Left Top Logo, Chat & Notes & Market Buttons, Left Side User Account, Right Top Model & Hamburger */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
          {/* Left Side: Brand Logo, Top-Left Chat, Notes & Market Buttons, and User Account */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Logo */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex cursor-pointer items-center gap-2 shrink-0 group"
            >
              <RabbitLogo size="sm" />
              <span className="hidden md:inline-block text-base font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {t("appTitle")}
              </span>
            </button>

            <div className="h-6 w-px bg-border/80 hidden sm:block" />

            {/* Top Navigation Buttons: Chat, Notes, and Market */}
            <div className="flex items-center gap-1 rounded-2xl bg-muted/60 p-1 border border-border/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveView("chat")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  activeView === "chat"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView("notes")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  activeView === "notes"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView("market")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  activeView === "market"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Market</span>
              </button>
            </div>

            <div className="h-6 w-px bg-border/80 hidden lg:block" />

            {/* Left Side: User Account Badge */}
            <button
              type="button"
              onClick={() => setHamburgerOpen(true)}
              title="Korisnički profil i meni"
              className="hidden lg:flex cursor-pointer items-center gap-2.5 rounded-2xl border border-border/70 bg-card/70 px-3 py-1.5 text-left transition-all hover:border-primary/40 hover:bg-muted/60 shadow-2xs"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-extrabold text-primary">
                {initials || "S"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground leading-tight max-w-[120px]">
                  {displayName}
                </p>
                <p className="truncate text-[10px] text-muted-foreground flex items-center gap-1 leading-tight">
                  <Flame className="h-2.5 w-2.5 text-amber-500" /> {t("activeStudent")} • {currentLangInfo?.flag}
                </p>
              </div>
            </button>
          </div>

          {/* Right Side Controls: AI Model Engine Status + Hamburger Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Model indicator */}
            <div
              onClick={() => setSettingsOpen(true)}
              className="hidden sm:flex cursor-pointer items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs text-foreground transition-all hover:bg-primary/10 hover:border-primary/40 shadow-2xs"
              title="Podešavanja AI Modela"
            >
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-[11px]">{providerInfo.model}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Hamburger Menu Trigger Button */}
            <button
              type="button"
              onClick={() => setHamburgerOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 text-xs font-extrabold text-foreground shadow-2xs transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
              title="Meni (Istorija, Fokus tajmer, Offline, Teme, Jezik, Odjava)"
            >
              <Menu className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Meni</span>
              {sessions.length > 0 && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-5 md:p-6">
        {/* View 1: Focused AI Chat Tutor */}
        {activeView === "chat" && (
          <div className="h-full">
            <ChatView
              key={chatKey}
              initialMessages={initialMessages}
              onSaveSession={handleSaveSession}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenHamburger={() => setHamburgerOpen(true)}
            />
          </div>
        )}

        {/* View 2: Notes Generator Studio */}
        {activeView === "notes" && (
          <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-300">
            <div className="space-y-5 lg:col-span-5">
              <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Generiši Nove Beleške
                    </h2>
                  </div>
                  {notes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveView("library")}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Biblioteka ({notes.length})
                    </button>
                  )}
                </div>
                <GenerateForm onGenerate={handleGenerate} isLoading={isGenerating} />
              </section>
            </div>

            <div className="lg:col-span-7">
              <section className="min-h-[580px] rounded-3xl border border-border/80 bg-card p-6 shadow-md">
                <GeneratedContent
                  content={currentContent}
                  isGenerating={isGenerating}
                  onSave={handleSave}
                  saved={isSaved}
                />
              </section>
            </div>
          </div>
        )}

        {/* View 3: Student PDF Notes Market */}
        {activeView === "market" && (
          <MarketView onOpenNotesStudio={() => setActiveView("notes")} />
        )}

        {/* View 4: Full Library & Revision */}
        {activeView === "library" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-md space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">{t("libraryTab")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sačuvane lekcije i beleške dostupne 100% offline u tvom pretraživaču.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setActiveView("notes")}
                className="gap-2 rounded-xl text-xs font-bold shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nova Beleška
              </Button>
            </div>

            {notes.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">Tvoja biblioteka je još uvek prazna</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Generiši beleške u Studiju ili sačuvaj odgovore iz AI Chata direktno u biblioteku.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className="group cursor-pointer rounded-2xl border border-border/70 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {note.content.keyPoints.length} Tačaka
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive"
                          title="Obriši ovu belešku"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary">
                      {note.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {note.content.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hamburger Slide-Over Drawer */}
      <HamburgerMenu
        open={hamburgerOpen}
        onClose={() => setHamburgerOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        notes={notes}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        onOpenNotesTab={() => setActiveView("notes")}
        onOpenMarketTab={() => setActiveView("market")}
        onOpenLibraryTab={() => setActiveView("library")}
        timerSeconds={timerSeconds}
        timerActive={timerActive}
        timerMode={timerMode}
        onToggleTimer={toggleTimer}
        onResetTimer={resetTimer}
      />

      {/* Detailed AI Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
