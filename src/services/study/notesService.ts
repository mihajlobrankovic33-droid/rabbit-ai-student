import type { ChatSession, Note } from "@/types/study";

const AUTH_STORAGE_KEY = "study_buddy_current_user";

export function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) return user.id;
    }
  } catch {
    // fallback
  }
  return "default_student";
}

function getNotesStorageKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `study_buddy_notes_${uid}`;
}

function getSessionsStorageKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `study_buddy_sessions_${uid}`;
}

export function getNotes(userId?: string): Note[] {
  try {
    const key = getNotesStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Fallback: check legacy un-scoped key if user has no notes in new key
    const legacyRaw = localStorage.getItem("study_buddy_notes");
    if (legacyRaw) {
      const parsed: Note[] = JSON.parse(legacyRaw);
      localStorage.setItem(key, JSON.stringify(parsed));
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveNote(note: Note, userId?: string): void {
  try {
    const uid = userId || note.userId || getCurrentUserId();
    const key = getNotesStorageKey(uid);
    const existing = getNotes(uid);
    const updatedNote = { ...note, userId: uid, updatedAt: new Date().toISOString() };
    const index = existing.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      existing[index] = updatedNote;
    } else {
      existing.unshift(updatedNote);
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save note:", err);
  }
}

export function deleteNote(id: string, userId?: string): void {
  try {
    const uid = userId || getCurrentUserId();
    const key = getNotesStorageKey(uid);
    const existing = getNotes(uid);
    const filtered = existing.filter((n) => n.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete note:", err);
  }
}

export function getChatSessions(userId?: string): ChatSession[] {
  try {
    const key = getSessionsStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Fallback: check legacy un-scoped key if user has no sessions in new key
    const legacyRaw = localStorage.getItem("study_buddy_sessions");
    if (legacyRaw) {
      const parsed: ChatSession[] = JSON.parse(legacyRaw);
      localStorage.setItem(key, JSON.stringify(parsed));
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveChatSession(session: ChatSession, userId?: string): void {
  try {
    const uid = userId || session.userId || getCurrentUserId();
    const key = getSessionsStorageKey(uid);
    const existing = getChatSessions(uid);
    const updatedSession = { ...session, userId: uid };
    const index = existing.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      existing[index] = updatedSession;
    } else {
      existing.unshift(updatedSession);
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save chat session:", err);
  }
}

export function deleteChatSession(id: string, userId?: string): void {
  try {
    const uid = userId || getCurrentUserId();
    const key = getSessionsStorageKey(uid);
    const existing = getChatSessions(uid);
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete chat session:", err);
  }
}
