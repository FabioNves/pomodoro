"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WEEK_SETTINGS,
  WEEK_SETTINGS_EVENT,
  WEEK_SETTINGS_KEY,
  loadWeekSettings,
  saveWeekSettings,
} from "@/lib/weekSettings";

/**
 * Week preferences (which day a week starts on). Reads localStorage after
 * mount and follows changes made elsewhere (Settings page, other tabs).
 */
export function useWeekSettings() {
  const [settings, setSettings] = useState(DEFAULT_WEEK_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadWeekSettings());
    setReady(true);
    const onLocal = (e) => setSettings(e.detail || loadWeekSettings());
    const onStorage = (e) => {
      if (e.key === WEEK_SETTINGS_KEY) setSettings(loadWeekSettings());
    };
    window.addEventListener(WEEK_SETTINGS_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WEEK_SETTINGS_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => saveWeekSettings({ ...prev, ...patch }));
  }, []);

  return { settings, update, ready };
}
