import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  getSupabase,
  isSupabaseConfigured,
  supabaseErrorMessage,
} from "@/services/study/supabaseClient";

export interface User {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  isAnonymous?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (provider: string, params?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>;
}

const AUTH_STORAGE_KEY = "study_buddy_current_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface SupabaseUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/** Maps a Supabase auth user onto the app's local User shape. */
function fromSupabaseUser(u: SupabaseUserLike): User {
  const meta = u.user_metadata || {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    (u.email ? u.email.split("@")[0] : "") ||
    "Student";
  const avatar =
    (typeof meta.picture === "string" && meta.picture) ||
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    undefined;
  return {
    id: u.id,
    name,
    ...(u.email ? { email: u.email } : {}),
    ...(avatar ? { avatar } : {}),
    isAnonymous: false,
  };
}

function persistUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // storage may be unavailable — the in-memory user still works
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Local cache first (guest mode + last known signed-in profile)…
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load user auth:", e);
    }

    // …then the real Supabase session, which wins when it exists.
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const applySession = (session: { user?: SupabaseUserLike } | null) => {
      if (cancelled) return;
      if (session?.user) {
        const mapped = fromSupabaseUser(session.user);
        setUser(mapped);
        persistUser(mapped);
      }
      setIsLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch((err) => {
        console.warn("Supabase session check failed:", err);
        if (!cancelled) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (provider: string, params: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      if (provider === "anonymous") {
        const guestUser: User = {
          id: `guest-${Date.now()}`,
          name: "Guest Student",
          isAnonymous: true,
        };
        setUser(guestUser);
        persistUser(guestUser);
      } else if (provider === "google") {
        const supabase = getSupabase();
        if (!supabase) {
          throw new Error(
            "Supabase nije podešen — dodaj VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY u .env"
          );
        }
        // Full OAuth round-trip: Google → Supabase → back to the dashboard.
        // The session is then stored by supabase-js, so the student stays
        // signed in and their messages / puškice live in the cloud.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/dashboard`
                : undefined,
          },
        });
        if (error) throw new Error(supabaseErrorMessage(error));
      } else if (provider === "password") {
        const email = String(params.email || "");
        const password = String(params.password || "");
        const flow = String(params.flow || "signIn");
        const supabase = getSupabase();

        if (supabase) {
          if (flow === "signUp") {
            const name = String(params.name || email.split("@")[0] || "Student");
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: { data: { display_name: name, full_name: name } },
            });
            if (error) throw new Error(supabaseErrorMessage(error));
            if (data.user && data.user.identities?.length === 0) {
              throw new Error("Nalog sa ovim emailom već postoji.");
            }
            if (!data.session) {
              throw new Error(
                "Poslali smo ti email za potvrdu — otvori link pa se prijavi ponovo."
              );
            }
            if (data.user) {
              const mapped = fromSupabaseUser(data.user);
              setUser(mapped);
              persistUser(mapped);
            }
          } else {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw new Error(supabaseErrorMessage(error));
            if (data.user) {
              const mapped = fromSupabaseUser(data.user);
              setUser(mapped);
              persistUser(mapped);
            }
          }
          return;
        }

        // No Supabase configured → keep the old local-only behaviour.
        const name = String(params.name || email.split("@")[0] || "Student");
        const authedUser: User = {
          id: `user-${Date.now()}`,
          name,
          email,
          isAnonymous: false,
        };
        setUser(authedUser);
        persistUser(authedUser);
      } else if (provider === "email-otp") {
        const email = String(params.email || "");
        if (params.code) {
          const authedUser: User = {
            id: `user-${Date.now()}`,
            name: email.split("@")[0] || "Student",
            email,
            isAnonymous: false,
          };
          setUser(authedUser);
          persistUser(authedUser);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) console.warn("Supabase sign-out:", supabaseErrorMessage(error));
      }
      setUser(null);
      persistUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; avatar?: string }) => {
    setUser((prev) => {
      if (!prev) {
        const fallbackUser: User = {
          id: `user-${Date.now()}`,
          name: updates.name?.trim() || "Student",
          avatar: updates.avatar,
          isAnonymous: false,
        };
        persistUser(fallbackUser);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("study_buddy_profile_updated", { detail: fallbackUser })
          );
        }
        return fallbackUser;
      }
      const updatedUser: User = {
        ...prev,
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
      };
      persistUser(updatedUser);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("study_buddy_profile_updated", { detail: updatedUser })
        );
      }
      return updatedUser;
    });
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      signIn,
      signOut,
      updateProfile,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
