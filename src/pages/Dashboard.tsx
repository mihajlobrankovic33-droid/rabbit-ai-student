import { ChatHistory } from "@/components/study/ChatHistory";
import { ChatView } from "@/components/study/ChatView";
import { GenerateForm } from "@/components/study/GenerateForm";
import { GeneratedContent } from "@/components/study/GeneratedContent";
import { NotesList } from "@/components/study/NotesList";
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
import type { ChatMessage, ChatSession, Note, StudyContent } from "@/types/study";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Library,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
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
}

function SidebarTab({ active, onClick, icon, label }: SidebarTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { generateNotes } = useStudyAI();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = (theme ?? resolvedTheme ?? "light") === "dark";

  const [activeView, setActiveView] = useState<"chat" | "notes">("chat");
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  }, []);

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
    [generateNotes],
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
    [activeNoteId, refreshNotes],
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
    [activeSessionId, refreshSessions],
  );

  const handleSelectSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setInitialMessages(session.messages);
    setChatKey(session.id);
    setShowMobileLibrary(false);
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
    [activeSessionId, handleNewChat, refreshSessions],
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

  const mobileLibraryOpen = showMobileLibrary;
  const toggleMobileLibrary = () => setShowMobileLibrary((v) => !v);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex cursor-pointer items-center gap-2"
          >
            <RabbitLogo className="h-8 w-8 rounded-xl" />
            <span className="text-sm font-bold tracking-tight text-foreground">Study Buddy</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveView("chat");
                setShowMobileLibrary(false);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeView === "chat"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
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
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeView === "notes"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Notes
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-5 px-4 py-5 md:px-6 lg:py-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 flex-col rounded-2xl border border-border/70 bg-card/60 lg:flex">
          <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex cursor-pointer items-center gap-2.5"
            >
              <RabbitLogo className="h-9 w-9 rounded-xl" />
              <span className="text-left">
                <span className="block text-sm font-bold tracking-tight text-foreground">
                  Study Buddy
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Your AI study assistant
                </span>
              </span>
            </button>
          </div>

          <div className="space-y-1 px-3 py-3">
            <SidebarTab
              active={activeView === "chat"}
              onClick={() => {
                setActiveView("chat");
                setShowMobileLibrary(false);
              }}
              icon={<MessageSquare className="h-4 w-4" />}
              label="AI Chat"
            />
            <SidebarTab
              active={activeView === "notes"}
              onClick={() => {
                setActiveView("notes");
                setShowMobileLibrary(false);
              }}
              icon={<GraduationCap className="h-4 w-4" />}
              label="Study Notes"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {activeView === "chat" ? (
              <>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Chat history
                  </p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    title="New chat"
                    className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
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
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    My library
                  </p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {notes.length}
                  </span>
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

          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials || "S"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user?.email ?? "Signed in"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDark ? "Switch to light theme" : "Switch to dark theme"}
                  className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                  className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {activeView === "chat" ? "AI Chat" : "Study Notes"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeView === "chat"
                  ? "Ask anything — explanations, homework help, summaries, and more"
                  : "Turn any topic into structured notes with key points and a summary"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={toggleTheme}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {isDark ? "Light mode" : "Dark mode"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" />
                Settings
              </Button>
            </div>
          </div>

          {activeView === "chat" ? (
            <div className="mx-auto max-w-3xl">
              {/* Mobile sessions toggle */}
              <div className="mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={toggleMobileLibrary}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Library className="h-4 w-4 text-primary" />
                    Chat history
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {sessions.length}
                    </span>
                  </span>
                  {mobileLibraryOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {mobileLibraryOpen && (
                  <div className="animate-in mt-2 rounded-xl border border-border/70 bg-card p-2.5 slide-in-from-top-2 duration-200">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sessions
                      </p>
                      <button
                        type="button"
                        onClick={handleNewChat}
                        className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New chat
                      </button>
                    </div>
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
          ) : (
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-5">
                <section className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Generate new notes
                    </h2>
                  </div>
                  <GenerateForm onGenerate={handleGenerate} isLoading={isGenerating} />
                </section>

                {/* Mobile library */}
                <section className="lg:hidden">
                  <button
                    type="button"
                    onClick={toggleMobileLibrary}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      My study notes
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {notes.length}
                      </span>
                    </span>
                    {mobileLibraryOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {mobileLibraryOpen && (
                    <div className="animate-in mt-2 rounded-xl border border-border/70 bg-card p-2.5 slide-in-from-top-2 duration-200">
                      <NotesList
                        notes={notes}
                        activeNoteId={activeNoteId}
                        onSelectNote={handleSelectNote}
                        onDeleteNote={handleDeleteNote}
                      />
                    </div>
                  )}
                </section>
              </div>

              <div className="lg:col-span-7">
                <section className="min-h-[560px] rounded-2xl border border-border/70 bg-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isGenerating
                          ? "bg-amber-400"
                          : currentContent
                            ? "bg-primary"
                            : "bg-muted-foreground"
                      }`}
                    />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {isGenerating
                        ? "Generating…"
                        : currentContent
                          ? "Generated content"
                          : "AI output"}
                    </h2>
                  </div>
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
        </main>
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
