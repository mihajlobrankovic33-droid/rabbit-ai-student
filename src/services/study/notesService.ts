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
    let parsed: Note[] = [];

    if (raw) {
      parsed = JSON.parse(raw);
    } else {
      // Fallback: check legacy un-scoped key if user has no notes in new key
      const legacyRaw = localStorage.getItem("study_buddy_notes");
      if (legacyRaw) {
        parsed = JSON.parse(legacyRaw);
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.map((n) => {
      // Handle potential double nesting e.g. { content: { content: ... } }
      let contentObj = (n.content || {}) as Record<string, unknown>;
      if (contentObj && typeof contentObj === "object" && "content" in contentObj && contentObj.content) {
        contentObj = (contentObj.content || {}) as Record<string, unknown>;
      }

      const safeKeyPoints = Array.isArray(contentObj.keyPoints)
        ? (contentObj.keyPoints as unknown[]).map(String)
        : typeof contentObj.keyPoints === "string"
        ? [contentObj.keyPoints]
        : [];

      return {
        ...n,
        title: n.title || (typeof contentObj.title === "string" ? contentObj.title : "Beleške"),
        topic: n.topic || "",
        content: {
          title: typeof contentObj.title === "string" ? contentObj.title : (n.title || "Beleške"),
          keyPoints: safeKeyPoints,
          summary: typeof contentObj.summary === "string" ? contentObj.summary : "",
          fullNotes: typeof contentObj.fullNotes === "string" ? contentObj.fullNotes : "",
        },
      };
    });
  } catch {
    return [];
  }
}

export function saveNote(note: Note, userId?: string): void {
  try {
    const uid = userId || note.userId || getCurrentUserId();
    const key = getNotesStorageKey(uid);
    const existing = getNotes(uid);

    let contentObj = (note.content || {}) as Record<string, unknown>;
    if (contentObj && typeof contentObj === "object" && "content" in contentObj && contentObj.content) {
      contentObj = (contentObj.content || {}) as Record<string, unknown>;
    }

    const safeKeyPoints = Array.isArray(contentObj.keyPoints)
      ? (contentObj.keyPoints as unknown[]).map(String)
      : typeof contentObj.keyPoints === "string"
      ? [contentObj.keyPoints]
      : [];

    const sanitizedNote: Note = {
      ...note,
      title: note.title || (typeof contentObj.title === "string" ? contentObj.title : "Beleške"),
      topic: note.topic || "",
      content: {
        title: typeof contentObj.title === "string" ? contentObj.title : (note.title || "Beleške"),
        keyPoints: safeKeyPoints,
        summary: typeof contentObj.summary === "string" ? contentObj.summary : "",
        fullNotes: typeof contentObj.fullNotes === "string" ? contentObj.fullNotes : "",
      },
      userId: uid,
      updatedAt: new Date().toISOString(),
    };

    const index = existing.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      existing[index] = sanitizedNote;
    } else {
      existing.unshift(sanitizedNote);
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
