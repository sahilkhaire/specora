import { useEffect, useState } from "react";
import { readScopedItem, writeScopedItem } from "@/data/scoped-storage";
import type { ThemeMode } from "@/app/header-types";

const THEME_STORAGE_KEY = "theme-mode";
const THEME_LEGACY_KEY = "specora-theme-mode";

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const value = readScopedItem(THEME_STORAGE_KEY, THEME_LEGACY_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Persisted theme preference, resolved against the OS setting and applied to <html>. */
export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    themeMode === "system" ? systemTheme() : themeMode
  );

  useEffect(() => {
    writeScopedItem(THEME_STORAGE_KEY, themeMode);

    if (themeMode !== "system") {
      setResolvedTheme(themeMode);
      return;
    }
    if (typeof window.matchMedia !== "function") {
      setResolvedTheme("light");
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return { themeMode, setThemeMode, resolvedTheme };
}
