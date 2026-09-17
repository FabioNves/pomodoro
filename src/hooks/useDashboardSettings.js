"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DASHBOARD_SETTINGS_EVENT,
  DASHBOARD_SETTINGS_KEY,
  DEFAULT_DASHBOARD_SETTINGS,
  loadDashboardSettings,
  saveDashboardSettings,
} from "@/lib/dashboardSettings";

/**
 * Dashboard preferences (whether the quote machine is shown). Reads
 * localStorage after mount and follows changes made elsewhere (the Settings
 * page, another tab).
 */
export function useDashboardSettings() {
  const [settings, setSettings] = useState(DEFAULT_DASHBOARD_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadDashboardSettings());
    setReady(true);
    const onLocal = (e) => setSettings(e.detail || loadDashboardSettings());
    const onStorage = (e) => {
      if (e.key === DASHBOARD_SETTINGS_KEY) setSettings(loadDashboardSettings());
    };
    window.addEventListener(DASHBOARD_SETTINGS_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DASHBOARD_SETTINGS_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => saveDashboardSettings({ ...prev, ...patch }));
  }, []);

  return { settings, update, ready };
}
