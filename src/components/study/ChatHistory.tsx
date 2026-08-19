import React from "react";
import type { ChatSession } from "@/types/study";
import { MessageSquare, Trash2 } from "lucide-react";

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

export function ChatHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: ChatHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
        No past chats yet. Start a conversation!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => {
        const isActive = activeSessionId === session.id;
        return (
          <div
            key={session.id}
            className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectSession(session)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{session.title || "Chat session"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              title="Delete session"
              className="cursor-pointer rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
