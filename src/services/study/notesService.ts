import type { ChatSession, Note } from "@/types/study";

const NOTES_KEY = "study_buddy_notes";
const SESSIONS_KEY = "study_buddy_sessions";

export function getNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNote(note: Note): void {
  try {
    const existing = getNotes();
    const index = existing.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      existing[index] = note;
    } else {
      existing.unshift(note);
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save note:", err);
  }
}

export function deleteNote(id: string): void {
  try {
    const existing = getNotes();
    const filtered = existing.filter((n) => n.id !== id);
    localStorage.setItem(NOTES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete note:", err);
  }
}

export function getChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatSession(session: ChatSession): void {
  try {
    const existing = getChatSessions();
    const index = existing.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      existing[index] = session;
    } else {
      existing.unshift(session);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save chat session:", err);
  }
}

export function deleteChatSession(id: string): void {
  try {
    const existing = getChatSessions();
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete chat session:", err);
  }
}
