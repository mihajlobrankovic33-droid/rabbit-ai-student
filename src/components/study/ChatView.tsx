import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage, Note } from "@/types/study";
import { Button } from "@/components/ui/button";
import { useStudyAI } from "@/hooks/use-study-ai";
import { getSelectedAIProvider } from "@/services/study/aiService";
import { getOllamaConfig } from "@/services/study/ollamaService";
import { getSavedBrowserModel, IN_BROWSER_MODELS } from "@/services/study/webLlmService";
import { useI18n, SUPPORTED_LANGUAGES } from "@/services/study/i18n";
import { saveNote } from "@/services/study/notesService";
import Markdown from "react-markdown";
import {
  ArrowRight,
  BookMarked,
  Check,
  Copy,
  Cpu,
  Download,
  Lightbulb,
  Loader2,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ChatViewProps {
  initialMessages?: ChatMessage[];
  onSaveSession?: (messages: ChatMessage[]) => void;
  onOpenSettings?: () => void;
  onOpenHamburger?: () => void;
}

const STARTER_PROMPTS_BY_LANG: Record<string, { label: string; text: string }[]> = {
  sr: [
    { label: "🧮 Granične vrednosti (Limesi)", text: "Objasni mi kako se rešavaju limesi sa neodređenim oblicima 0/0 korak po korak sa primerima." },
    { label: "⚛️ Fotosinteza & Ćelija", text: "Objasni detaljno proces fotosinteze: svetlu fazu, tamnu fazu (Kalvinov ciklus) i hemijsku jednačinu." },
    { label: "📜 Francuska Revolucija", text: "Koji su bili glavni uzroci, ključni događaji i posledice Francuske revolucije 1789. godine?" },
    { label: "💻 Rekurzija u Programiranju", text: "Objasni rekurziju na primeru računanja faktorijela i Fibonačijevog niza u Pythonu/C++." },
    { label: "🎯 Kviz za Ponavljanje", text: "Postavi mi 3 teška pitanja sa višestrukim izborom iz opšte hemije da proverim svoje znanje." },
  ],
  en: [
    { label: "🧮 Calculus Limits", text: "Explain how to evaluate limits with indeterminate forms 0/0 step-by-step with examples." },
    { label: "⚛️ Photosynthesis & Biology", text: "Break down light-dependent reactions, the Calvin cycle, and the overall photosynthesis formula." },
    { label: "📜 French Revolution", text: "What were the core socioeconomic triggers and lasting outcomes of the French Revolution in 1789?" },
    { label: "💻 Recursion in Python", text: "Explain recursive thinking vs iterative loops using Fibonacci and Factorial code examples." },
    { label: "🎯 Active Recall Quiz", text: "Generate a 3-question active recall test on Newton's Laws of Motion with explanations." },
  ],
};

const QUICK_ACTIONS_BY_LANG: Record<string, string[]> = {
  sr: ["✨ Objasni jednostavnije", "📝 Daj mi praktičan primer", "⚡ Reši korak po korak", "🎯 Testiraj moje znanje (Kviz)"],
  en: ["✨ Explain simpler", "📝 Give real-world example", "⚡ Solve step-by-step", "🎯 Test my knowledge (Quiz)"],
};

export function ChatView({ initialMessages = [], onSaveSession, onOpenSettings }: ChatViewProps) {
  const { lang, t } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: "welcome-1",
            role: "assistant",
            content: t("welcomeChat"),
            createdAt: new Date().toISOString(),
          },
        ]
  );

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const { chatWithAI, cancelGeneration, isLoading } = useStudyAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentProvider = getSelectedAIProvider();
  const ollamaConfig = getOllamaConfig();
  const savedBrowserModel = getSavedBrowserModel();
  const browserModelName = IN_BROWSER_MODELS.find((m) => m.id === savedBrowserModel)?.name || "WebGPU";
  const currentLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);

  const starterPrompts = STARTER_PROMPTS_BY_LANG[lang] || STARTER_PROMPTS_BY_LANG.en;
  const quickActions = QUICK_ACTIONS_BY_LANG[lang] || QUICK_ACTIONS_BY_LANG.en;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Adjust textarea height dynamically
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const reply = await chatWithAI(textToSend, newMessages);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      onSaveSession?.(finalMessages);
    } catch (err: unknown) {
      console.warn("Chat error:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(t("copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsNote = (msg: ChatMessage) => {
    const lines = msg.content.split("\n").filter((l) => l.trim().length > 0);
    const title = lines[0]?.replace(/^[#*\s-]+/, "").slice(0, 50) || "AI Study Explanation";
    const note: Note = {
      id: `note-${Date.now()}`,
      title,
      topic: "Saved from AI Chat",
      createdAt: new Date().toISOString(),
      content: {
        title,
        keyPoints: lines.slice(1, 6).map((l) => l.replace(/^[#*\s-]+/, "").slice(0, 120)),
        summary: msg.content.slice(0, 200) + "...",
        fullNotes: msg.content,
      },
    };
    saveNote(note);
    setSavedNoteId(msg.id);
    toast.success("Saved directly to your Study Notes Library!");
    setTimeout(() => setSavedNoteId(null), 2500);
  };

  const handleExportChat = () => {
    const textContent = messages
      .map(
        (m) =>
          `[${m.role === "user" ? "Student" : "Study Buddy AI"}] (${new Date(
            m.createdAt
          ).toLocaleTimeString()}):\n${m.content}\n\n`
      )
      .join("---\n\n");

    const blob = new Blob([textContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `StudyBuddy-Session-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Chat conversation exported as Markdown!");
  };

  const handleClearChat = () => {
    cancelGeneration();
    const fresh: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: t("welcomeChat"),
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(fresh);
    onSaveSession?.(fresh);
    toast.success(t("clearChat"));
  };

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] md:h-[calc(100vh-8.5rem)] flex-col rounded-3xl border border-border/80 bg-card/95 shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/25 px-3 sm:px-6 py-2 sm:py-2.5 text-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary shadow-xs">
            <span className="text-sm sm:text-base">🐰</span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-foreground text-xs sm:text-sm tracking-tight truncate">
                {t("chatTab")}
              </span>

              {/* Active AI Model Chip */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex cursor-pointer items-center gap-1 sm:gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-foreground transition-all hover:bg-primary/20 hover:scale-102"
                  title="Promeni AI Model ili Podešavanja"
                >
                  {currentProvider === "gemini" && (
                    <>
                      <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                      <span className="truncate max-w-[90px] sm:max-w-none">Gemini Thinking</span>
                    </>
                  )}
                  {currentProvider === "ollama" && (
                    <>
                      <Cpu className="h-3 w-3 text-blue-500" />
                      <span className="font-mono truncate max-w-[90px] sm:max-w-none">{ollamaConfig.selectedModel}</span>
                    </>
                  )}
                  {currentProvider === "in_browser" && (
                    <>
                      <Zap className="h-3 w-3 text-emerald-500" />
                      <span className="truncate max-w-[90px] sm:max-w-none">{browserModelName}</span>
                    </>
                  )}
                  {currentProvider === "builtin_offline" && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      <span>Built-in Brain</span>
                    </>
                  )}
                  <Settings2 className="h-3 w-3 text-muted-foreground ml-0.5 hidden sm:inline" />
                </button>
              )}

              {/* Language Pill */}
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <span>{currentLangInfo?.flag}</span>
                <span>{currentLangInfo?.name}</span>
              </span>
            </div>
            <span className="text-muted-foreground text-[10px] hidden md:inline">
              {t("appSubtitle")} • 100% Offline Ready
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {isLoading && (
            <button
              type="button"
              onClick={cancelGeneration}
              className="flex cursor-pointer items-center gap-1 sm:gap-1.5 rounded-xl bg-destructive/15 px-2 sm:px-3 py-1.5 text-xs font-bold text-destructive transition-all hover:bg-destructive/25 animate-pulse"
            >
              <Square className="h-3 w-3 fill-current" />
              <span className="hidden sm:inline">{t("stopGenerating")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportChat}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-border/70 bg-background px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Preuzmi transkript razgovora (.md)"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Izvezi</span>
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-border/70 bg-background px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive"
            title="Isprazni i očisti razgovor"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Isprazni Chat</span>
          </button>
        </div>
      </div>

      {/* Suggested Starter Chips */}
      {messages.length <= 2 && (
        <div className="border-b border-border/40 bg-muted/15 px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-primary">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {t("quickQuestions")}:
            </span>
            {starterPrompts.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSend(p.text)}
                className="cursor-pointer rounded-full border border-border/80 bg-card px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium text-foreground/90 transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary shadow-2xs hover:scale-102"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-sm mt-0.5">
                  🐰
                </div>
              )}

              <div className="group relative max-w-[92%] sm:max-w-[85%] md:max-w-[80%]">
                <div
                  className={`rounded-3xl px-3.5 sm:px-4.5 py-3 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                    isUser
                      ? "rounded-br-xs bg-primary font-medium text-primary-foreground shadow-sm shadow-primary/20"
                      : "rounded-bl-xs border border-border/80 bg-muted/40 text-foreground"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <div className="markdown-chat-content font-normal text-[13px] sm:text-[13.5px] break-words">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>

                {/* Assistant Message Tool Footer */}
                {!isUser && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 sm:gap-3 px-1 sm:px-2 text-[10px] sm:text-[11px] text-muted-foreground opacity-90 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex cursor-pointer items-center gap-1 hover:text-foreground font-medium transition-colors min-h-[30px]"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">{t("copied")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>{t("copy")}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveAsNote(msg)}
                      className="flex cursor-pointer items-center gap-1 hover:text-primary font-medium transition-colors min-h-[30px]"
                    >
                      {savedNoteId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Sačuvano!</span>
                        </>
                      ) : (
                        <>
                          <BookMarked className="h-3 w-3 text-primary" />
                          <span>{t("saveToNotes")}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(`Možeš li mi ovo objasniti jednostavnije sa slikovitom analogijom?`)
                      }
                      className="flex cursor-pointer items-center gap-1 hover:text-amber-500 font-medium transition-colors min-h-[30px]"
                    >
                      <Lightbulb className="h-3 w-3 text-amber-500" />
                      <span>Pojednostavi</span>
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground border border-border/60 mt-0.5">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-bold animate-pulse">
              🐰
            </div>
            <div className="flex items-center gap-2 sm:gap-3 rounded-3xl rounded-bl-xs border border-border/80 bg-muted/40 px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-muted-foreground shadow-xs">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">{t("synthesizing")}</span>
              <button
                type="button"
                onClick={cancelGeneration}
                className="cursor-pointer ml-1 sm:ml-2 font-bold text-destructive hover:underline"
              >
                {t("stopGenerating")}
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Pills for Students */}
      <div className="border-t border-border/50 bg-background/50 px-4 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Brze Komande:
          </span>
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => handleSend(action)}
              className="cursor-pointer rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[10px] font-medium text-foreground/80 transition-all hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Composer Input Area */}
      <div className="border-t border-border/70 bg-background/90 p-3 sm:p-4 backdrop-blur-md">
        <div className="flex items-end gap-2.5">
          <div className="relative flex-1 rounded-2xl border border-input bg-card shadow-xs transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={t("askPlaceholder")}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40 min-h-[44px]"
            />
            <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-muted-foreground">
              <span className="hidden sm:inline">
                💡 <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd> za slanje,{" "}
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Shift+Enter</kbd> za novi red
              </span>
              {input.length > 0 && <span className="font-mono">{input.length} karaktera</span>}
            </div>
          </div>

          {isLoading ? (
            <Button
              type="button"
              onClick={cancelGeneration}
              variant="destructive"
              className="h-11 px-4 rounded-2xl gap-1.5 font-bold shadow-xs shrink-0"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>{t("stopGenerating")}</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="h-11 w-11 shrink-0 rounded-2xl p-0 font-bold shadow-sm shadow-primary/20 transition-all hover:scale-105"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
