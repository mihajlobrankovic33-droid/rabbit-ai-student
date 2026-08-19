import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/study";
import { Button } from "@/components/ui/button";
import { useStudyAI } from "@/hooks/use-study-ai";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ChatViewProps {
  initialMessages?: ChatMessage[];
  onSaveSession?: (messages: ChatMessage[]) => void;
}

const STARTER_PROMPTS = [
  { label: "🧮 Calculus Limits", text: "Explain how to evaluate limits with indeterminate forms 0/0 intuitively." },
  { label: "⚛️ Quantum Physics", text: "Explain wave-particle duality and the double-slit experiment simply." },
  { label: "🧬 Cellular Respiration", text: "Break down glycolysis, the Krebs cycle, and oxidative phosphorylation." },
  { label: "💻 Big-O Notation", text: "Compare Time Complexity O(n log n) vs O(n^2) with code examples." },
  { label: "📜 French Revolution", text: "What were the core socioeconomic triggers of the French Revolution in 1789?" },
];

export function ChatView({ initialMessages = [], onSaveSession }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: "welcome-1",
            role: "assistant",
            content:
              "Hey there! 👋 I'm Study Buddy, your 24/7 AI study companion. I never sleep, never get tired, and work fully offline.\n\nAsk me anything — from breaking down calculus formulas and physics laws to summarizing history chapters or generating active recall quiz questions!",
            createdAt: new Date().toISOString(),
          },
        ]
  );
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { chatWithAI, cancelGeneration, isLoading } = useStudyAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Explanation copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    cancelGeneration();
    const fresh: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "Chat reset! What topic or problem would you like to explore now? 🐰📚",
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(fresh);
    onSaveSession?.(fresh);
    toast.success("Chat refreshed — new conversation started.");
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-3xl border border-border/80 bg-card/90 shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 sm:px-6 py-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold text-foreground">Interactive AI Tutor</span>
            <span className="text-muted-foreground ml-2 hidden sm:inline">• 24/7 Night Owl Mode</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && (
            <button
              type="button"
              onClick={cancelGeneration}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition-all hover:bg-destructive/20 animate-pulse"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop / Break</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearChat}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Reset conversation"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Suggested Starter Chips */}
      {messages.length <= 2 && (
        <div className="border-b border-border/40 bg-muted/15 px-4 sm:px-6 py-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              Quick Questions:
            </span>
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSend(p.text)}
                className="cursor-pointer rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-medium text-foreground/80 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-bold shadow-xs">
                  🐰
                </div>
              )}

              <div className="group relative max-w-[85%] sm:max-w-[78%]">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? "rounded-br-xs bg-primary font-medium text-primary-foreground"
                      : "rounded-bl-xs border border-border/70 bg-muted/40 text-foreground whitespace-pre-wrap"
                  }`}
                >
                  {msg.content}
                </div>

                {!isUser && (
                  <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-bold">
              🐰
            </div>
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-xs border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Synthesizing clear explanation…</span>
              <button
                type="button"
                onClick={cancelGeneration}
                className="cursor-pointer ml-1 text-xs font-semibold text-destructive hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="border-t border-border/70 bg-background/60 p-3 sm:p-4 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything (e.g. 'Explain Newton's 3rd Law' or 'Write a Python binary search')..."
            className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={cancelGeneration}
              variant="destructive"
              className="h-11 px-4 rounded-2xl gap-2 font-semibold shadow-xs"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              className="h-11 w-11 shrink-0 p-0 rounded-2xl font-semibold shadow-xs"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
