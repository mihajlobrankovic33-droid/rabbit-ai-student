/**
 * Puškice (cheat sheets) service
 * - Persists generated cheat sheets in localStorage (scoped per student)
 * - Talks to the two-stage AI pipeline:
 *     1) /api/ai/puskice/batch — digests one chunk of images / PDF / text
 *     2) /api/ai/puskice/final — merges digests into the final short puskice
 *       (server also adds verified Wolfram Alpha formulas for STEM subjects)
 */

import { getCurrentUserId } from "@/services/study/notesService";
import {
  getSupabase,
  isCloudUserId,
  isSupabaseConfigured,
  supabaseErrorMessage,
} from "@/services/study/supabaseClient";

export type PuskiceKind = "images" | "pdf";

export interface Puskice {
  id: string;
  subject: string;
  markdown: string;
  kind: PuskiceKind;
  fileCount: number;
  userId: string;
  createdAt: string;
}

export interface UploadImage {
  data: string; // base64 (without data: prefix)
  mimeType: string;
}

const STORAGE_KEY = "study_buddy_puskice";

function storageKey(userId?: string): string {
  return `${STORAGE_KEY}_${userId || getCurrentUserId()}`;
}

export function getPuskice(userId?: string): Puskice[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Puskice[]) : [];
  } catch {
    return [];
  }
}

export function savePuskice(item: Puskice): void {
  try {
    const uid = item.userId || getCurrentUserId();
    const existing = getPuskice(uid).filter((p) => p.id !== item.id);
    existing.unshift(item);
    localStorage.setItem(storageKey(uid), JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save puskice:", err);
  }
}

export function deletePuskice(id: string, userId?: string): void {
  try {
    const uid = userId || getCurrentUserId();
    const filtered = getPuskice(uid).filter((p) => p.id !== id);
    localStorage.setItem(storageKey(uid), JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete puskice:", err);
  }
}

export function newPuskiceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pusk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/* ------------------------------------------------------------------ */
/* Cloud sync (signed-in students only)                                */
/* localStorage stays as a fast cache; Supabase is the durable copy    */
/* so cheat sheets survive cleared browser data / other devices.       */
/* ------------------------------------------------------------------ */

function cloudOn(userId?: string | null): boolean {
  return isSupabaseConfigured && isCloudUserId(userId);
}

interface PuskiceRow {
  id: string;
  subject: string;
  markdown: string;
  kind: string;
  file_count: number;
  user_id: string;
  created_at: string;
}

/** Loads puškice: from Supabase when signed in, from localStorage otherwise. */
export async function loadPuskice(userId?: string): Promise<Puskice[]> {
  const uid = userId || getCurrentUserId();
  if (!cloudOn(uid)) return getPuskice(uid);
  const sb = getSupabase();
  if (!sb) return getPuskice(uid);

  const { data, error } = await sb
    .from("puskice")
    .select("id, subject, markdown, kind, file_count, user_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Cloud puškice load failed:", supabaseErrorMessage(error));
    return getPuskice(uid);
  }
  const list = ((data || []) as PuskiceRow[]).map((row): Puskice => ({
    id: row.id,
    subject: row.subject,
    markdown: row.markdown,
    kind: row.kind === "pdf" ? "pdf" : "images",
    fileCount: row.file_count,
    userId: row.user_id,
    createdAt: row.created_at,
  }));
  // warm the local cache so the list also works offline
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
  return list;
}

/** Saves a puškice in the cloud (no-op for guests). Throws on failure. */
export async function savePuskiceCloud(item: Puskice): Promise<void> {
  if (!cloudOn(item.userId)) return;
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("puskice").insert({
    id: item.id,
    user_id: item.userId,
    subject: item.subject,
    markdown: item.markdown,
    kind: item.kind,
    file_count: item.fileCount,
  });
  if (error) throw new Error(supabaseErrorMessage(error));
}

/** Deletes a puškice from the cloud (no-op for guests). */
export async function deletePuskiceCloud(
  id: string,
  userId?: string
): Promise<void> {
  const uid = userId || getCurrentUserId();
  if (!cloudOn(uid)) return;
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("puskice")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) throw new Error(supabaseErrorMessage(error));
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // fall through
  }
  return `Greška servera (${res.status})`;
}

/** Digests one chunk (images batch / PDF / text) into a short summary. */
export async function fetchBatchDigest(input: {
  subject: string;
  kind: PuskiceKind | "text";
  part: number;
  total: number;
  images?: UploadImage[];
  pdf?: { data: string };
  text?: string;
}): Promise<string> {
  const res = await fetch("/api/ai/puskice/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { summary?: string };
  return data.summary || "";
}

/** Merges digests into the final cheat sheet (markdown). */
export async function fetchFinalPuskice(
  subject: string,
  parts: string[]
): Promise<{ markdown: string; source: string }> {
  const res = await fetch("/api/ai/puskice/final", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, parts }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { markdown?: string; source?: string };
  return { markdown: data.markdown || "", source: data.source || "gemini" };
}
