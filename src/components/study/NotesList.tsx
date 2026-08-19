import React from "react";
import type { Note } from "@/types/study";
import { BookOpen, Trash2 } from "lucide-react";

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
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
        No saved notes in your library yet. Generate some notes to save them!
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {notes.map((note) => {
        const isActive = activeNoteId === note.id;
        return (
          <div
            key={note.id}
            className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectNote(note)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{note.title}</p>
                {note.topic && (
                  <p className="truncate text-[10px] text-muted-foreground">{note.topic}</p>
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
