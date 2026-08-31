export type ColorTheme = "default" | "ocean" | "emerald" | "amber" | "rose" | "cyber";

export interface ColorThemeOption {
  id: ColorTheme;
  name: string;
  nativeName: string;
  previewColor: string;
  accentColor: string;
}

export const COLOR_THEMES: ColorThemeOption[] = [
  { id: "default", name: "Royal Violet", nativeName: "Kraljevsko Ljubičasta", previewColor: "#8b5cf6", accentColor: "#7c3aed" },
  { id: "ocean", name: "Sapphire Ocean", nativeName: "Safirno Plava", previewColor: "#3b82f6", accentColor: "#2563eb" },
  { id: "emerald", name: "Forest Emerald", nativeName: "Smaragdno Zelena", previewColor: "#10b981", accentColor: "#059669" },
  { id: "amber", name: "Warm Sunset", nativeName: "Topli Amber / Sunce", previewColor: "#f59e0b", accentColor: "#d97706" },
  { id: "rose", name: "Rose Quartz", nativeName: "Ružičasta", previewColor: "#f43f5e", accentColor: "#e11d48" },
  { id: "cyber", name: "Cyber Neon", nativeName: "Sajber Neon", previewColor: "#c084fc", accentColor: "#9333ea" },
];

const COLOR_THEME_KEY = "study_buddy_color_theme";

export function getSavedColorTheme(): ColorTheme {
  try {
    const saved = localStorage.getItem(COLOR_THEME_KEY);
    if (saved && COLOR_THEMES.some((t) => t.id === saved)) {
      return saved as ColorTheme;
    }
  } catch {
    // ignore
  }
  return "default";
}

export function applyColorTheme(theme: ColorTheme): void {
  try {
    localStorage.setItem(COLOR_THEME_KEY, theme);
    if (typeof document !== "undefined") {
      if (theme === "default") {
        document.documentElement.removeAttribute("data-color-theme");
      } else {
        document.documentElement.setAttribute("data-color-theme", theme);
      }
    }
  } catch {
    // ignore
  }
}

// Initial auto-apply on script load
if (typeof window !== "undefined") {
  applyColorTheme(getSavedColorTheme());
}
