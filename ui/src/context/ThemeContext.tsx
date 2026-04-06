import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "titanclip";

const VALID_THEMES: Theme[] = ["light", "dark", "titanclip"];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "titanclip.theme";
const THEME_COLORS: Record<Theme, string> = {
  light: "#FDFCFB",
  dark: "#1C1D28",
  titanclip: "#241E1A",
};
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;
  if (root.classList.contains("titanclip")) return "titanclip";
  if (root.classList.contains("dark")) return "dark";
  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "titanclip");
  // For titanclip: apply both "dark" (so dark: variants work) and "titanclip" (for CSS variable overrides)
  if (theme === "dark") root.classList.add("dark");
  if (theme === "titanclip") { root.classList.add("dark", "titanclip"); }
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
  }
}

/** Cycle order: light → dark → titanclip → light */
const CYCLE_ORDER: Theme[] = ["light", "dark", "titanclip"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => resolveThemeFromDocument());

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const idx = CYCLE_ORDER.indexOf(current);
      return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]!;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
