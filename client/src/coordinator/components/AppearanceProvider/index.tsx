"use client";

import { Theme } from "@radix-ui/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AppearanceTheme = "dark" | "light";
type Appearance = { theme: AppearanceTheme; setTheme: (theme: AppearanceTheme) => void };
const AppearanceContext = createContext<Appearance | null>(null);
const STORAGE_KEY = "swarm.appearance.v1";

function readTheme(): AppearanceTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setLocalTheme] = useState<AppearanceTheme>(readTheme);
  const setTheme = useCallback((next: AppearanceTheme) => {
    setLocalTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <AppearanceContext.Provider value={value}><Theme appearance={theme} accentColor="green" radius="large">{children}</Theme></AppearanceContext.Provider>;
}

export function useAppearance(): Appearance {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error("useAppearance must be used within an AppearanceProvider");
  return appearance;
}
