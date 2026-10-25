import React, { useCallback, useEffect, useState } from "react";
import { ChatView } from "@/components/study/ChatView";
import { PuskiceView } from "@/components/study/PuskiceView";
import { MessagesView } from "@/components/study/MessagesView";
import { RabbitLogo } from "@/components/study/RabbitLogo";
import { SettingsModal } from "@/components/study/SettingsModal";
import { HamburgerMenu } from "@/components/study/HamburgerMenu";
import { UserProfileModal } from "@/components/study/UserProfileModal";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/services/study/i18n";
import {
  deleteChatSession,
  getChatSessions,
  saveChatSession,
} from "@/services/study/notesService";
import { getSelectedAIProvider } from "@/services/study/aiService";
import type { ChatMessage, ChatSession } from "@/types/study";
import { Cpu, Menu, MessageSquare, MessagesSquare, NotebookPen } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [activeView, setActiveView] = useState<"chat" | "puskice" | "messages">("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Pomodoro Focus Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");

  // AI Provider info
  const [providerInfo, setProviderInfo] = useState({ provider: "builtin_offline", model: "" });

  // Chat state - scoped to active student
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [chatKey, setChatKey] = useState(`chat-${Date.now()}`);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load chat sessions and notes strictly for the logged-in student
  const currentUserId = user?.id || "default_student";

  useEffect(() => {
    setSessions(getChatSessions(currentUserId));

    const updateProvider = () => {
      const prov = getSelectedAIProvider();
      setProviderInfo({
        provider: prov,
        model:
          prov === "gemini"
            ? "Gemini Flash (AI)"
            : prov === "in_browser"
            ? "In-Browser WebGPU"
            : "Built-in Brain",
      });
    };

    updateProvider();

    window.addEventListener("study_buddy_provider_changed", updateProvider);
    return () => {
      window.removeEventListener("study_buddy_provider_changed", updateProvider);
    };
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

  const refreshSessions = useCallback(() => setSessions(getChatSessions(currentUserId)), [currentUserId]);

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

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary flex flex-col">
      {/* Top Header Bar: Left Top Logo, Chat & Notes & Market Buttons, Right Top Model & Hamburger */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
          {/* Left Side: Brand Logo, Top-Left Chat, Notes & Market Buttons */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Logo */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center gap-2 shrink-0 group"
            >
              <RabbitLogo size="sm" />
              <span className="hidden md:inline-block text-base font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {t("appTitle")}
              </span>
            </button>

            <div className="h-6 w-px bg-border/80 hidden sm:block" />

            {/* Top Navigation Button: Chat — hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center gap-1 rounded-2xl bg-muted/60 p-1 border border-border/60 shadow-2xs">
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
                onClick={() => setActiveView("puskice")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  activeView === "puskice"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <NotebookPen className="h-3.5 w-3.5" />
                <span>Puškice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView("messages")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  activeView === "messages"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <MessagesSquare className="h-3.5 w-3.5" />
                <span>{t("messagesTab")}</span>
              </button>
            </div>
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
              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 text-xs font-extrabold text-foreground shadow-2xs transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
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
      <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-5 md:p-6 pb-24 md:pb-8">
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
        {/* View 2: Puškice — AI reads images / PDF and makes short cheat sheets */}
        {activeView === "puskice" && <PuskiceView userId={currentUserId} />}

        {/* View 3: Messages — friends via 6-char codes */}
        {activeView === "messages" && (
          <MessagesView userId={currentUserId} userName={user?.name} />
        )}
      </main>

      {/* Mobile Floating Bottom Navigation Bar (Visible only on mobile/tablet) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-lg pb-safe md:hidden shadow-lg">
        <div className="flex h-16 items-center justify-around px-2">
          <button
            type="button"
            onClick={() => setActiveView("chat")}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-h-[44px] ${
              activeView === "chat"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <MessageSquare className={`h-5 w-5 ${activeView === "chat" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("puskice")}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-h-[44px] ${
              activeView === "puskice"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <NotebookPen
              className={`h-5 w-5 ${activeView === "puskice" ? "scale-110" : ""}`}
            />
            <span className="text-[10px] mt-1">Puškice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("messages")}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-h-[44px] ${
              activeView === "messages"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <MessagesSquare
              className={`h-5 w-5 ${activeView === "messages" ? "scale-110" : ""}`}
            />
            <span className="text-[10px] mt-1">{t("messagesTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => setHamburgerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-center text-muted-foreground hover:text-foreground transition-colors min-h-[44px] relative"
          >
            <div className="relative">
              <Menu className="h-5 w-5" />
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {sessions.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium">Meni</span>
          </button>
        </div>
      </nav>

      {/* Hamburger Slide-Over Drawer */}
      <HamburgerMenu
        open={hamburgerOpen}
        onClose={() => setHamburgerOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        timerSeconds={timerSeconds}
        timerActive={timerActive}
        timerMode={timerMode}
        onToggleTimer={toggleTimer}
        onResetTimer={resetTimer}
      />

      {/* Detailed AI Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* User Profile & Author Name Edit Modal */}
      <UserProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}
