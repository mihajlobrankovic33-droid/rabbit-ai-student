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
      <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground bg-muted/10">
        <p className="font-semibold text-foreground mb-1">No Past Chats</p>
        <p>Your conversations are saved automatically in your browser storage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
      {sessions.map((session) => {
        const isActive = activeSessionId === session.id;
        return (
          <div
            key={session.id}
            className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all ${
              isActive
                ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                : "border border-border/50 bg-card/60 text-muted-foreground hover:border-primary/30 hover:bg-card hover:text-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectSession(session)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <span className="truncate font-medium text-foreground">{session.title || "Chat Session"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              title="Delete session"
              className="cursor-pointer rounded-lg p-1.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 ml-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
