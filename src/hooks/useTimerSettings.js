"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TIMER_SETTINGS,
  TIMER_SETTINGS_EVENT,
  TIMER_SETTINGS_KEY,
  loadTimerSettings,
  saveTimerSettings,
} from "@/lib/timerSettings";

/**
 * Timer personalisation (sounds, clock format, defaults). Reads localStorage
 * after mount and follows changes made elsewhere (Settings page, other tabs).
 */
export function useTimerSettings() {
  const [settings, setSettings] = useState(DEFAULT_TIMER_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadTimerSettings());
    setReady(true);
    const onLocal = (e) => setSettings(e.detail || loadTimerSettings());
    const onStorage = (e) => {
      if (e.key === TIMER_SETTINGS_KEY) setSettings(loadTimerSettings());
    };
    window.addEventListener(TIMER_SETTINGS_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TIMER_SETTINGS_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = saveTimerSettings({ ...prev, ...patch });
      return next || prev;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(saveTimerSettings(DEFAULT_TIMER_SETTINGS));
  }, []);

  return { settings, update, reset, ready };
}
