import React, { useCallback, useEffect, useState } from "react";
import { ChatHistory } from "@/components/study/ChatHistory";
import { ChatView } from "@/components/study/ChatView";
import { GenerateForm } from "@/components/study/GenerateForm";
import { GeneratedContent } from "@/components/study/GeneratedContent";
import { NotesList } from "@/components/study/NotesList";
import { OfflineBanner } from "@/components/study/OfflineBanner";
import { RabbitLogo } from "@/components/study/RabbitLogo";
import { SettingsModal } from "@/components/study/SettingsModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useStudyAI } from "@/hooks/use-study-ai";
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
  ChevronDown,
  ChevronUp,
  Cpu,
  Flame,
  GraduationCap,
  Library,
  LogOut,
  MessageSquare,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Timer,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface SidebarTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
}

function SidebarTab({ active, onClick, icon, label, badge }: SidebarTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { generateNotes } = useStudyAI();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = (theme ?? resolvedTheme ?? "light") === "dark";

  const [activeView, setActiveView] = useState<"chat" | "notes" | "library">("chat");
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pomodoro Focus Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState({ provider: "builtin_offline", model: "" });

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentContent, setCurrentContent] = useState<StudyContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [chatKey, setChatKey] = useState(`chat-${Date.now()}`);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(getNotes());
    setSessions(getChatSessions());
    const prov = getSelectedAIProvider();
    const ollama = getOllamaConfig();
    setProviderInfo({
      provider: prov,
      model: prov === "ollama" ? ollama.selectedModel : prov === "gemini" ? "Gemini 2.5 Flash" : "Built-in Offline",
    });
  }, [settingsOpen]);

  // Pomodoro Timer Tick Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      if (timerMode === "focus") {
        toast.success("Great job! 25m Focus session complete. Take a 5m break! ☕");
        setTimerMode("break");
        setTimerSeconds(5 * 60);
      } else {
        toast.info("Break finished! Ready for another study round? 🐰📚");
        setTimerMode("focus");
        setTimerSeconds(25 * 60);
      }
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds, timerMode]);

  const toggleTimer = () => setTimerActive(!timerActive);
  const resetTimer = () => {
    setTimerActive(false);
    setTimerSeconds(timerMode === "focus" ? 25 * 60 : 5 * 60);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const refreshNotes = useCallback(() => setNotes(getNotes()), []);
  const refreshSessions = useCallback(() => setSessions(getChatSessions()), []);

  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, [isDark, setTheme]);

  const handleGenerate = useCallback(
    async (title: string, topic: string) => {
      setIsGenerating(true);
      setCurrentContent(null);
      setIsSaved(false);
      setActiveNoteId(null);
      setCurrentTitle(title);
      setCurrentTopic(topic);
      try {
        const { content } = await generateNotes(title, topic);
        setCurrentContent(content);
      } finally {
        setIsGenerating(false);
      }
    },
    [generateNotes]
  );

  const handleSave = useCallback(() => {
    if (!currentContent) return;
    const newNote: Note = {
      id: makeId(),
      title: currentTitle || currentContent.title,
      topic: currentTopic,
      content: currentContent,
      createdAt: new Date().toISOString(),
    };
    saveNote(newNote);
    setIsSaved(true);
    setActiveNoteId(newNote.id);
    refreshNotes();
    toast.success("Note saved to your library");
  }, [currentContent, currentTitle, currentTopic, refreshNotes]);

  const handleSelectNote = useCallback((note: Note) => {
    setCurrentContent(note.content);
    setCurrentTitle(note.title);
    setCurrentTopic(note.topic);
    setIsSaved(true);
    setIsGenerating(false);
    setActiveNoteId(note.id);
    setShowMobileLibrary(false);
    setActiveView("notes");
  }, []);

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote(id);
      refreshNotes();
      if (activeNoteId === id) {
        setCurrentContent(null);
        setActiveNoteId(null);
        setIsSaved(false);
      }
      toast("Note deleted");
    },
    [activeNoteId, refreshNotes]
  );

  const handleSaveSession = useCallback(
    (messages: ChatMessage[]) => {
      if (messages.length === 0) return;
      const id = activeSessionId ?? `chat-${Date.now()}`;
      const session: ChatSession = {
        id,
        title: messages[0].content.slice(0, 40) || "Chat session",
        messages,
        createdAt: new Date().toISOString(),
      };
      saveChatSession(session);
      setActiveSessionId(id);
      refreshSessions();
    },
    [activeSessionId, refreshSessions]
  );

  const handleSelectSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setInitialMessages(session.messages);
    setChatKey(session.id);
    setShowMobileLibrary(false);
    setActiveView("chat");
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setInitialMessages([]);
    setChatKey(`chat-${Date.now()}`);
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteChatSession(id);
      refreshSessions();
      if (activeSessionId === id) handleNewChat();
      toast("Chat session deleted");
    },
    [activeSessionId, handleNewChat, refreshSessions]
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = user?.name || user?.email || "Student";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Mobile Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex cursor-pointer items-center gap-2"
          >
            <RabbitLogo size="sm" />
            <span className="text-sm font-bold tracking-tight text-foreground">Study Buddy</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveView("chat");
                setShowMobileLibrary(false);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                activeView === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("notes");
                setShowMobileLibrary(false);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                activeView === "notes" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Notes
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-5 md:px-6 lg:py-6">
        {/* Desktop Left Control Sidebar */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-80 shrink-0 flex-col rounded-3xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-md lg:flex">
          {/* Top Brand Header */}
          <div className="flex items-center justify-between border-b border-border/60 p-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex cursor-pointer items-center gap-3"
            >
              <RabbitLogo size="md" />
              <div className="text-left">
                <span className="block text-base font-extrabold tracking-tight text-foreground">
                  Study Buddy
                </span>
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Never Sleeps • 24/7 AI
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                title={isDark ? "Switch to light theme" : "Switch to dark theme"}
                className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="AI & Offline Settings"
                className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active Study Timer / Pomodoro Widget */}
          <div className="m-3 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-muted/30 to-background p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {timerMode === "focus" ? "Focus Sprint" : "Rest Break"}
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-foreground">
                {formatTimer(timerSeconds)}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleTimer}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all ${
                  timerActive
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-primary text-primary-foreground shadow-xs"
                }`}
              >
                {timerActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{timerActive ? "Pause" : "Start"}</span>
              </button>
              <button
                type="button"
                onClick={resetTimer}
                title="Reset timer"
                className="cursor-pointer rounded-xl border border-border/70 bg-background p-1.5 text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Main Navigation Views Switcher */}
          <div className="space-y-1.5 px-3">
            <SidebarTab
              active={activeView === "chat"}
              onClick={() => {
                setActiveView("chat");
                setShowMobileLibrary(false);
              }}
              icon={<MessageSquare className="h-4 w-4" />}
              label="AI Chat Tutor"
              badge={sessions.length || undefined}
            />
            <SidebarTab
              active={activeView === "notes"}
              onClick={() => {
                setActiveView("notes");
                setShowMobileLibrary(false);
              }}
              icon={<GraduationCap className="h-4 w-4" />}
              label="Study Notes Studio"
            />
            <SidebarTab
              active={activeView === "library"}
              onClick={() => {
                setActiveView("library");
                setShowMobileLibrary(false);
              }}
              icon={<Library className="h-4 w-4" />}
              label="Saved Library"
              badge={notes.length}
            />
          </div>

          {/* Secondary dynamic list: Chat history or Notes list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 border-t border-border/50 mt-2">
            {activeView === "chat" ? (
              <>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Chat History
                  </p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    title="New conversation"
                    className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New</span>
                  </button>
                </div>
                <ChatHistory
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={handleSelectSession}
                  onDeleteSession={handleDeleteSession}
                  onNewChat={handleNewChat}
                />
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Saved Notes ({notes.length})
                  </p>
                </div>
                <NotesList
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onSelectNote={handleSelectNote}
                  onDeleteNote={handleDeleteNote}
                />
              </>
            )}
          </div>

          {/* User Profile Footer */}
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-extrabold text-primary">
                {initials || "S"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
                <p className="truncate text-[10px] text-muted-foreground flex items-center gap-1">
                  <Flame className="h-2.5 w-2.5 text-amber-500" /> Active Student
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Work Area */}
        <main className="min-w-0 flex-1 space-y-4">
          <OfflineBanner onOpenSettings={() => setSettingsOpen(true)} />

          {/* Desktop Status Header */}
          <div className="hidden items-center justify-between lg:flex rounded-2xl border border-border/70 bg-card/60 px-5 py-3 shadow-xs">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
                {activeView === "chat" && "💬 AI Study Chat"}
                {activeView === "notes" && "📝 Study Notes Studio"}
                {activeView === "library" && "📚 Saved Notes Library"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeView === "chat" && "Ask anything — homework assistance, derivations, intuitive analogies, and revision quizzes."}
                {activeView === "notes" && "Turn any topic into exam-ready structured notes with core takeaways."}
                {activeView === "library" && "Browse, search, and review all saved study materials offline."}
              </p>
            </div>

            {/* Active Model Indicator Pill */}
            <div className="flex items-center gap-3">
              <div
                onClick={() => setSettingsOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-foreground transition-all hover:bg-primary/10"
              >
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">{providerInfo.model}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>

          {/* View 1: AI Chat */}
          {activeView === "chat" && (
            <div className="mx-auto max-w-4xl">
              {/* Mobile history accordion */}
              <div className="mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowMobileLibrary(!showMobileLibrary)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Past Sessions ({sessions.length})
                  </span>
                  {showMobileLibrary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showMobileLibrary && (
                  <div className="mt-2 rounded-2xl border border-border/70 bg-card p-3 shadow-md">
                    <ChatHistory
                      sessions={sessions}
                      activeSessionId={activeSessionId}
                      onSelectSession={handleSelectSession}
                      onDeleteSession={handleDeleteSession}
                      onNewChat={handleNewChat}
                    />
                  </div>
                )}
              </div>

              <ChatView
                key={chatKey}
                initialMessages={initialMessages}
                onSaveSession={handleSaveSession}
              />
            </div>
          )}

          {/* View 2: Notes Generator Studio */}
          {activeView === "notes" && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-5">
                <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-md">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Generate New Study Notes
                    </h2>
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

          {/* View 3: Full Library & Revision */}
          {activeView === "library" && (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-md space-y-5">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">My Study Library</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saved notes and revisions stored locally in your browser.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setActiveView("notes")}
                  className="gap-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="h-4 w-4" />
                  Create New Note
                </Button>
              </div>

              {notes.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">No notes in your library yet</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Generate exam-ready notes in the Study Notes Studio and save them here for quick revision.
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
                          {note.content.keyPoints.length} Points
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
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
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
