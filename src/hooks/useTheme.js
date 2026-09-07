"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  THEMES,
  DEFAULT_THEME,
  applyTheme,
  getTheme,
  isValidTheme,
} from "@/lib/themes";

const ThemeContext = createContext();
const STORAGE_KEY = "theme";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    // The inline script in layout.js already applied the saved theme before
    // first paint; this syncs React state and normalises stale values.
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    const initial = isValidTheme(saved) ? saved : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial);
    if (initial !== saved) {
      try {
        localStorage.setItem(STORAGE_KEY, initial);
      } catch (e) {}
    }
  }, []);

  const setTheme = (id) => {
    const next = isValidTheme(id) ? id : DEFAULT_THEME;
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
  };

  const isDark = getTheme(theme).dark;

  // Backwards-compatible light/dark switch.
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, isDark, themes: THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
