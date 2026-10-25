import React, { useCallback, useEffect, useState } from "react";
import { ThemeContext, type Theme } from "./use-theme";

/**
 * Lightweight theme provider (replacement for next-themes).
 *
 * next-themes renders a <script> tag inside the React tree; with React 19 that
 * script is never executed and React logs an error on every page load. The
 * initial theme is already applied by the inline bootstrap script in
 * index.html (no flash), so this provider only needs to keep <html class> and
 * localStorage("theme") in sync from then on.
 */

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable — fall through to default
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const dark = theme === "system" ? systemPrefersDark() : theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
    applyThemeClass(theme);

    if (theme !== "system") return;
    // Follow the OS preference live while "system" is selected
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
