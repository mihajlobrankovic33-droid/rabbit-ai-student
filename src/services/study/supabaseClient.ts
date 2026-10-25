/**
 * Supabase client — cloud auth + cloud storage.
 *
 * Why: localStorage disappears when the student clears browser data or opens
 * the app on another device, so messages and puškice were getting lost.
 * Everything user-generated that must survive now lives in Supabase:
 *   - auth        → email/password + Google sign-in (Supabase Auth)
 *   - profiles    → 6-char friend code per student
 *   - messages    → direct messages between students
 *   - puskice     → saved cheat sheets
 *
 * Only the PUBLISHABLE key (safe for browsers, protected by Row Level
 * Security) is used here. The secret key must never reach the frontend.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

/** Shared Supabase browser client (null when env vars are missing). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        // Keeps the session across refreshes / closed tabs
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export interface SupabaseProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  code: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for Supabase auth ids (cloud identity), false for local/guest ids. */
export function isCloudUserId(id?: string | null): boolean {
  return Boolean(id && UUID_RE.test(id));
}

export function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg && msg !== "{}") return msg;
  }
  return "Greška na serveru";
}
