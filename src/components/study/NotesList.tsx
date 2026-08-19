import React, { useState } from "react";
import type { Note } from "@/types/study";
import { BookOpen, Search, Trash2 } from "lucide-react";

interface NotesListProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

export function NotesList({
  notes,
  activeNoteId,
  onSelectNote,
  onDeleteNote,
}: NotesListProps) {
  const [search, setSearch] = useState("");

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.topic.toLowerCase().includes(search.toLowerCase())
  );

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground bg-muted/10">
        <p className="font-semibold text-foreground mb-1">Your Library is Empty</p>
        <p>Generate your first study note to save and access it anytime offline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.length > 3 && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search saved notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-background pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {filtered.map((note) => {
          const isActive = activeNoteId === note.id;
          return (
            <div
              key={note.id}
              className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all ${
                isActive
                  ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                  : "border border-border/50 bg-card/60 text-muted-foreground hover:border-primary/30 hover:bg-card hover:text-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectNote(note)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{note.title}</p>
                  {note.topic && (
                    <p className="truncate text-[10px] text-muted-foreground mt-0.5">{note.topic}</p>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote(note.id);
                }}
                title="Delete note"
                className="cursor-pointer rounded-lg p-1.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 ml-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-3">No matching notes found.</p>
        )}
      </div>
    </div>
  );
}
