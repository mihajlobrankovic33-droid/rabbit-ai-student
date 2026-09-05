import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load user auth:", e);
    } finally {
      setIsLoading(false);
    }
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
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(guestUser));
      } else if (provider === "password") {
        const email = String(params.email || "");
        const name = String(params.name || email.split("@")[0] || "Student");
        const authedUser: User = {
          id: `user-${Date.now()}`,
          name,
          email,
          isAnonymous: false,
        };
        setUser(authedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authedUser));
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
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authedUser));
        }
      } else if (provider === "google") {
        const authedUser: User = {
          id: `google-${Date.now()}`,
          name: "Google Student",
          email: "student@gmail.com",
          isAnonymous: false,
        };
        setUser(authedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authedUser));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
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
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fallbackUser));
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
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
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
