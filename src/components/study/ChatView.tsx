import React, { useState, useRef, useEffect } from "react";
import type { AnimalTeacher, ChatMessage } from "@/types/study";
import { Button } from "@/components/ui/button";
import { useStudyAI } from "@/hooks/use-study-ai";
import { getSelectedAIProvider } from "@/services/study/aiService";
import { getSavedBrowserModel, IN_BROWSER_MODELS } from "@/services/study/webLlmService";
import { useI18n } from "@/services/study/i18n";
import {
  ANIMAL_TEACHERS,
  getActiveAnimalTeacher,
  setActiveAnimalTeacher,
} from "@/services/study/animalTeacherService";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ShareDialog } from "@/components/study/ShareDialog";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Lightbulb,
  Loader2,
  Share2,
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

export function ChatView({
  initialMessages = [],
  onSaveSession,
  onOpenSettings,
}: ChatViewProps) {
  const { lang, t } = useI18n();

  // Cute Animal Teacher State
  const [activeTeacher, setActiveTeacherState] = useState<AnimalTeacher>(getActiveAnimalTeacher());
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: "welcome-1",
            role: "assistant",
            content: `${activeTeacher.greetingSr} Ja sam ${activeTeacher.title} (${activeTeacher.species}). ${activeTeacher.catchphraseSr}\n\nKoju lekciju danas pripremamo za školu ili ispit? Možeš me pitati bilo šta ili tražiti da te ja ispitam pred tablom!`,
            createdAt: new Date().toISOString(),
          },
        ]
  );

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<ChatMessage | null>(null);
  const { chatWithAI, cancelGeneration, isLoading } = useStudyAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [currentProvider, setCurrentProvider] = useState(getSelectedAIProvider());

  useEffect(() => {
    const handleProviderChange = () => {
      setCurrentProvider(getSelectedAIProvider());
    };
    window.addEventListener("study_buddy_provider_changed", handleProviderChange);
    return () => {
      window.removeEventListener("study_buddy_provider_changed", handleProviderChange);
    };
  }, []);

  // Listen to external teacher change events
  useEffect(() => {
    const handleTeacherChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const match = ANIMAL_TEACHERS.find((t) => t.id === customEvent.detail);
      if (match) {
        setActiveTeacherState(match);
      }
    };
    window.addEventListener("study_buddy_animal_teacher_changed", handleTeacherChange);
    return () => {
      window.removeEventListener("study_buddy_animal_teacher_changed", handleTeacherChange);
    };
  }, []);

  const handleSelectTeacher = (teacher: AnimalTeacher) => {
    setActiveTeacherState(teacher);
    setActiveAnimalTeacher(teacher.id);
    setShowTeacherPicker(false);
    toast.success(`${teacher.title} (${teacher.species}) je sada tvoj nastavnik! ${teacher.emoji}`);
  };

  const savedBrowserModel = getSavedBrowserModel();
  const browserModelName = IN_BROWSER_MODELS.find((m) => m.id === savedBrowserModel)?.name || "WebGPU";

  const starterPrompts = STARTER_PROMPTS_BY_LANG[lang] || STARTER_PROMPTS_BY_LANG.en;
  const quickActions = [
    `🎯 Ispitaj me pred tablom!`,
    `🐾 ${activeTeacher.name}, daj mi primer!`,
    `✨ Objasni jednostavnije`,
    `📝 Zadaj mi blic pitanje`,
  ];

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

    let reply: string;
    try {
      reply = await chatWithAI(textToSend, newMessages, activeTeacher);
    } catch (err: unknown) {
      console.warn("Chat error:", err);
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "*(Generisanje je zaustavljeno)*"
          : "⚠️ **Došlo je do greške prilikom odgovora.**\n\nProveri da li je `GEMINI_API_KEY` podešen u `.env` fajlu i pokušaj ponovo.";
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reason,
        createdAt: new Date().toISOString(),
      };
      setMessages([...newMessages, assistantMsg]);
      return;
    }

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: reply || "*(Prazan odgovor)*",
      createdAt: new Date().toISOString(),
    };
    const finalMessages = [...newMessages, assistantMsg];
    setMessages(finalMessages);
    onSaveSession?.(finalMessages);
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

  const handleExportChat = () => {
    const textContent = messages
      .map(
        (m) =>
          `[${m.role === "user" ? "Student" : "Study Buddy AI"}] (${new Date(
            m.createdAt || Date.now()
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
    <div className="flex h-[calc(100dvh-11rem)] md:h-[calc(100vh-8.5rem)] flex-col rounded-3xl border border-border/80 bg-card/95 shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/25 px-3 sm:px-6 py-2 sm:py-2.5 text-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Active Animal Teacher Picker Button */}
          <button
            type="button"
            onClick={() => setShowTeacherPicker(!showTeacherPicker)}
            className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-foreground transition-all hover:bg-primary/20 hover:scale-102 sm:min-h-0"
            title="Klikni da promeniš životinjskog nastavnika"
          >
            <span className="text-base">{activeTeacher.emoji}</span>
            <div className="text-left hidden xs:block">
              <span className="block text-[11px] font-extrabold text-primary leading-tight">
                {activeTeacher.title}
              </span>
              <span className="block text-[9px] text-muted-foreground leading-tight">
                {activeTeacher.species}
              </span>
            </div>
            <span className="text-[10px] text-primary ml-0.5">▼</span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Active AI Model Chip */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="hidden sm:flex cursor-pointer items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 sm:px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                  title="Promeni AI Model ili Podešavanja"
                >
                  {currentProvider === "gemini" && (
                    <>
                      <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                      <span>Gemini Flash</span>
                    </>
                  )}
                  {currentProvider === "in_browser" && (
                    <>
                      <Zap className="h-3 w-3 text-emerald-500" />
                      <span>{browserModelName}</span>
                    </>
                  )}
                  {currentProvider === "builtin_offline" && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      <span>Built-in Brain</span>
                    </>
                  )}
                </button>
              )}
            </div>
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
            className="flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl border border-border/70 bg-background px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:min-h-0"
            title="Preuzmi transkript razgovora (.md)"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Izvezi</span>
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl border border-border/70 bg-background px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive sm:min-h-0"
            title="Isprazni i očisti razgovor"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Isprazni Chat</span>
          </button>
        </div>
      </div>

      {/* Teacher Picker Dropdown Tray */}
      {showTeacherPicker && (
        <div className="border-b border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <span>🐾</span> Izaberi svog slatkog životinjskog nastavnika:
            </span>
            <button
              type="button"
              onClick={() => setShowTeacherPicker(false)}
              className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              ✕ Zatvori
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {ANIMAL_TEACHERS.map((teacher) => {
              const isSelected = activeTeacher.id === teacher.id;
              return (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => handleSelectTeacher(teacher)}
                  className={`cursor-pointer rounded-xl border p-2 text-center transition-all flex items-center gap-2 sm:flex-col sm:justify-center ${
                    isSelected
                      ? "border-primary bg-primary/20 shadow-xs ring-2 ring-primary/40 font-bold"
                      : "border-border/70 bg-card hover:border-primary/40 hover:bg-card/90"
                  }`}
                >
                  <span className="text-2xl">{teacher.emoji}</span>
                  <div className="text-left sm:text-center min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{teacher.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{teacher.species}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Starter Chips — hidden on mobile so the chat fits the screen */}
      {messages.length <= 2 && (
        <div className="hidden sm:block border-b border-border/40 bg-muted/15 px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar">
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
                <div className="relative flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-card border border-primary/30 shadow-xs text-base sm:text-lg mt-0.5">
                  <span>{activeTeacher.emoji}</span>
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
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </Markdown>
                    </div>
                  )}
                </div>

                {/* Assistant Message Tool Footer */}
                {!isUser && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 sm:gap-3 px-1 sm:px-2 text-[10px] sm:text-[11px] text-muted-foreground opacity-90 transition-opacity">
                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex cursor-pointer items-center gap-1 hover:text-foreground font-medium transition-colors min-h-[40px] sm:min-h-[30px]"
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
                      onClick={() =>
                        handleSend(`Možeš li mi ovo objasniti jednostavnije sa slikovitom analogijom?`)
                      }
                      className="flex cursor-pointer items-center gap-1 hover:text-amber-500 font-medium transition-colors min-h-[40px] sm:min-h-[30px]"
                    >
                      <Lightbulb className="h-3 w-3 text-amber-500" />
                      <span>Pojednostavi</span>
                    </button>

                    {/* Share this AI answer with a friend */}
                    <button
                      type="button"
                      onClick={() => setShareMsg(msg)}
                      className="flex cursor-pointer items-center gap-1 hover:text-primary font-medium transition-colors min-h-[40px] sm:min-h-[30px]"
                    >
                      <Share2 className="h-3 w-3 text-primary" />
                      <span>{t("share")}</span>
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
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-card border border-primary/30 text-base sm:text-lg animate-bounce">
              {activeTeacher.emoji}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 rounded-3xl rounded-bl-xs border border-border/80 bg-muted/40 px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-muted-foreground shadow-xs">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">{activeTeacher.title} piše odgovor na tabli...</span>
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

      {/* Quick Action Pills for Students — hidden on mobile so more chat fits */}
      <div className="hidden sm:block border-t border-border/50 bg-background/50 px-4 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
            <span>{activeTeacher.rewardIcon}</span> Predlozi:
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
        <div className="flex items-end gap-2">
          <div className="relative flex-1 rounded-2xl border border-input bg-card shadow-xs transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Pitaj nastavnika (${activeTeacher.title}) ili odgovori...`}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-4 py-3 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40 min-h-[44px]"
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
              className="h-11 w-11 shrink-0 rounded-2xl p-0 font-bold shadow-sm shadow-primary/20 transition-all hover:scale-105 cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Share picker for an AI answer */}
      <ShareDialog
        open={shareMsg !== null}
        onOpenChange={(open) => {
          if (!open) setShareMsg(null);
        }}
        title="Odgovor AI"
        content={shareMsg?.content || ""}
      />
    </div>
  );
}
