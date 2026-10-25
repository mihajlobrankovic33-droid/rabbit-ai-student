import { createContext, useContext } from "react";

/**
 * Theme context (part of the lightweight next-themes replacement).
 * The provider lives in ./theme-provider.tsx so each file exports only
 * components (keeps react-refresh warning-free).
 */

export type Theme = "light" | "dark" | "system";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
