import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/study";
import { Button } from "@/components/ui/button";
import { useStudyAI } from "@/hooks/use-study-ai";
import { ArrowRight, Loader2, Sparkles, User, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ChatViewProps {
  initialMessages?: ChatMessage[];
  onSaveSession?: (messages: ChatMessage[]) => void;
}

export function ChatView({ initialMessages = [], onSaveSession }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: "welcome-1",
            role: "assistant",
            content:
              "Hey there! 👋 I'm Study Buddy, your friendly AI study assistant. Ask me anything — from breaking down formulas to summarizing complex topics or generating revision questions!",
            createdAt: new Date().toISOString(),
          },
        ]
  );
  const [input, setInput] = useState("");
  const { chatWithAI, cancelGeneration, isLoading } = useStudyAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = input.trim();
    if (!clean || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: clean,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    try {
      const reply = await chatWithAI(clean, newMessages);
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
    toast.success("Chat context refreshed — all repetitions cleared.");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-border/70 bg-card overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">Interactive AI Tutor</span>
          <span>• Anti-loop enabled</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <button
              type="button"
              onClick={cancelGeneration}
              className="flex cursor-pointer items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive transition-all hover:bg-destructive/20"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop / Break
            </button>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Clear chat and start fresh"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Chat</span>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border/70 bg-muted/40 text-foreground whitespace-pre-wrap"
                }`}
              >
                {msg.content}
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating fresh explanation…</span>
              <button
                type="button"
                onClick={cancelGeneration}
                className="cursor-pointer ml-2 text-xs font-semibold text-destructive hover:underline"
              >
                Stop
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-border/60 bg-background/50 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything (e.g. 'Explain calculus limits with an intuitive analogy')..."
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={cancelGeneration}
              variant="destructive"
              className="h-10 px-3 rounded-xl gap-1.5 text-xs"
              title="Stop Generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              className="h-10 w-10 shrink-0 p-0 rounded-xl"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
