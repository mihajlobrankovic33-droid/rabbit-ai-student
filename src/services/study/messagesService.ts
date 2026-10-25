/**
 * Messages service — friend codes + direct messaging.
 *
 * Every student gets a unique 6-char code (letters + numbers). You add a
 * friend by typing their code and then exchange messages. Shared items
 * (puškice or an AI answer) travel as a special "share" message.
 *
 * Storage:
 *   - Supabase (cloud) when the app is configured → messages survive
 *     cleared browser data, other devices and app restarts. Requires the
 *     student to be signed in (email or Google); RLS limits every row to
 *     its sender/recipient.
 *   - Local server JSON (server-data/*.json) as a fallback when Supabase
 *     env vars are missing.
 *
 * Contacts (the list of friends you added) stay on this device, keyed by
 * your user id.
 */

import { getCurrentUserId } from "@/services/study/notesService";
import {
  getSupabase,
  isCloudUserId,
  isSupabaseConfigured,
  supabaseErrorMessage,
} from "@/services/study/supabaseClient";

export { isCloudUserId };

export interface Contact {
  userId: string;
  name: string;
  code: string;
  addedAt: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  kind: "text" | "share";
  title?: string;
  createdAt: string;
}

const CONTACTS_KEY = "study_buddy_contacts";

/**
 * Hard cap on how many friends one student can have. Keeps the number of
 * Supabase lookups/polling queries small (and the list readable on a phone).
 */
export const MAX_CONTACTS = 10;

/** True when messages are stored in Supabase instead of the local server. */
export function isCloudMessages(): boolean {
  return isSupabaseConfigured;
}

/**
 * Cloud mode only for signed-in students: Supabase rows are keyed by the
 * auth uuid, while guests keep using the local server storage.
 */
function cloudFor(userId?: string | null): boolean {
  return isSupabaseConfigured && isCloudUserId(userId);
}

function contactsKey(userId?: string): string {
  return `${CONTACTS_KEY}_${userId || getCurrentUserId()}`;
}

export function getContacts(userId?: string): Contact[] {
  try {
    const raw = localStorage.getItem(contactsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Contact[]) : [];
  } catch {
    return [];
  }
}

/** Saves a friend. Returns false when the list is already at MAX_CONTACTS. */
export function addContact(contact: Contact, userId?: string): boolean {
  try {
    const current = getContacts(userId);
    const isNew = !current.some((c) => c.userId === contact.userId);
    if (isNew && current.length >= MAX_CONTACTS) return false;
    const list = current.filter((c) => c.userId !== contact.userId);
    list.unshift(contact);
    localStorage.setItem(contactsKey(userId), JSON.stringify(list));
    return true;
  } catch (err) {
    console.error("Failed to save contact:", err);
    return false;
  }
}

export function removeContact(id: string, userId?: string): void {
  try {
    const list = getContacts(userId).filter((c) => c.userId !== id);
    localStorage.setItem(contactsKey(userId), JSON.stringify(list));
  } catch (err) {
    console.error("Failed to remove contact:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Local-server fallback (used only when Supabase is not configured)   */
/* ------------------------------------------------------------------ */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
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

/**
 * In-flight de-dup: React (StrictMode / rapid re-renders) can call this
 * concurrently for the same user. Without sharing one promise, both callers
 * read "no profile yet", both insert, and the loser gets HTTP 409 in a loop.
 */
const registerInFlight = new Map<string, Promise<{ code: string; name: string }>>();

/** Registers me (creates the code on first use) and returns my code. */
export async function registerCode(
  userId: string,
  name: string
): Promise<{ code: string; name: string }> {
  const pending = registerInFlight.get(userId);
  if (pending) return pending;
  const run = doRegisterCode(userId, name).finally(() => registerInFlight.delete(userId));
  registerInFlight.set(userId, run);
  return run;
}

async function doRegisterCode(
  userId: string,
  name: string
): Promise<{ code: string; name: string }> {
  if (!cloudFor(userId)) {
    const res = await fetch("/api/msg/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as { code: string; name: string };
  }

  const sb = getSupabase();
  if (!sb) throw new Error("Supabase nije dostupan");

  const { data: existing, error: readErr } = await sb
    .from("profiles")
    .select("id, code, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) throw new Error(supabaseErrorMessage(readErr));

  // Keep the profile's email in sync so friends can see who they talk to.
  let email: string | null = null;
  try {
    const { data: sess } = await sb.auth.getSession();
    email = sess?.session?.user?.email ?? null;
  } catch {
    // email is optional — ignore
  }

  if (existing?.code) {
    if (name && existing.display_name !== name) {
      await sb.from("profiles").update({ display_name: name }).eq("id", userId);
    }
    return { code: existing.code, name: name || existing.display_name || "" };
  }

  // No profile yet — create one with a fresh unique code.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const { error } = await sb.from("profiles").insert({
      id: userId,
      code,
      display_name: name || "Učenik",
      ...(email ? { email } : {}),
    });
    if (!error) return { code, name: name || "Učenik" };

    const msg = supabaseErrorMessage(error);
    const isConflict =
      (error as { code?: string }).code === "23505" ||
      /duplicate|unique/i.test(msg);
    if (!isConflict) throw new Error(msg);

    // Conflict = either my row already exists (concurrent call won the race)
    // or this code is taken. Re-read before retrying — never re-insert the
    // same id, that would just loop on HTTP 409.
    const { data: again } = await sb
      .from("profiles")
      .select("id, code, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (again?.code) {
      return { code: again.code, name: name || again.display_name || "" };
    }
    if (again) {
      // Row exists but has no code yet → assign one via update instead.
      const fresh = randomCode();
      const { error: updErr } = await sb
        .from("profiles")
        .update({
          code: fresh,
          display_name: name || again.display_name || "Učenik",
          ...(email ? { email } : {}),
        })
        .eq("id", userId)
        .is("code", null);
      if (!updErr) return { code: fresh, name: name || "Učenik" };
      continue;
    }
    // Row still missing → the code itself collided, try another one.
  }
  throw new Error("Ne mogu da generišem slobodan kod. Pokušaj ponovo.");
}

/** Resolves a friend's 6-char code to their profile. */
export async function lookupCode(
  code: string,
  me?: string
): Promise<{ userId: string; name: string; code: string }> {
  if (!cloudFor(me)) {
    const res = await fetch("/api/msg/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as { userId: string; name: string; code: string };
  }

  const sb = getSupabase();
  if (!sb) throw new Error("Supabase nije dostupan");
  const { data, error } = await sb
    .from("profiles")
    .select("id, display_name, code")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(supabaseErrorMessage(error));
  if (!data) throw new Error("Kod nije pronađen. Proveri kod drugara.");
  return {
    userId: data.id,
    name: data.display_name || "Učenik",
    code: data.code,
  };
}

/** Resolves any user id to a profile (incoming unknown senders). */
export async function lookupUser(
  id: string
): Promise<{ userId: string; name: string; code: string } | null> {
  try {
    if (!cloudFor(id)) {
      const res = await fetch(`/api/msg/user?id=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return (await res.json()) as { userId: string; name: string; code: string };
    }
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from("profiles")
      .select("id, display_name, code")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      userId: data.id,
      name: data.display_name || "Učenik",
      code: data.code || "",
    };
  } catch {
    return null;
  }
}

interface MessageRow {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  kind: string;
  title: string | null;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    from: row.from_id,
    to: row.to_id,
    text: row.text,
    kind: row.kind === "share" ? "share" : "text",
    ...(row.title ? { title: row.title } : {}),
    createdAt: row.created_at,
  };
}

export async function sendMessage(msg: {
  from: string;
  to: string;
  text: string;
  kind?: "text" | "share";
  title?: string;
}): Promise<Message> {
  if (!cloudFor(msg.from)) {
    const res = await fetch("/api/msg/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { message: Message };
    return data.message;
  }

  const sb = getSupabase();
  if (!sb) throw new Error("Supabase nije dostupan");
  const { data, error } = await sb
    .from("messages")
    .insert({
      from_id: msg.from,
      to_id: msg.to,
      text: msg.text,
      kind: msg.kind === "share" ? "share" : "text",
      ...(msg.title ? { title: msg.title } : {}),
    })
    .select()
    .single();
  if (error) throw new Error(supabaseErrorMessage(error));
  return rowToMessage(data as MessageRow);
}

export async function fetchThread(me: string, peer: string): Promise<Message[]> {
  if (!cloudFor(me)) {
    const res = await fetch(
      `/api/msg/thread?me=${encodeURIComponent(me)}&peer=${encodeURIComponent(peer)}`
    );
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { messages: Message[] };
    return data.messages;
  }

  const sb = getSupabase();
  if (!sb) throw new Error("Supabase nije dostupan");
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .or(`and(from_id.eq.${me},to_id.eq.${peer}),and(from_id.eq.${peer},to_id.eq.${me})`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(supabaseErrorMessage(error));
  return ((data || []) as MessageRow[]).map(rowToMessage);
}

export async function fetchInbox(me: string, since: string): Promise<Message[]> {
  if (!cloudFor(me)) {
    const res = await fetch(
      `/api/msg/inbox?me=${encodeURIComponent(me)}&since=${encodeURIComponent(since)}`
    );
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { messages: Message[] };
    return data.messages;
  }

  const sb = getSupabase();
  if (!sb) throw new Error("Supabase nije dostupan");
  let query = sb
    .from("messages")
    .select("*")
    .eq("to_id", me)
    .order("created_at", { ascending: true });
  if (since) query = query.gt("created_at", since);
  const { data, error } = await query;
  if (error) throw new Error(supabaseErrorMessage(error));
  return ((data || []) as MessageRow[]).map(rowToMessage);
}
