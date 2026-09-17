// Dashboard preferences, persisted per device in localStorage like the timer
// and week settings. Safe to import on the server (no window access until a
// function runs in the browser).

export const DASHBOARD_SETTINGS_KEY = "pomo.dashboardSettings";
export const DASHBOARD_SETTINGS_EVENT = "pomo:dashboard-settings";

export const DEFAULT_DASHBOARD_SETTINGS = {
  // The quote machine on the dashboard. On by default: with no quotes of
  // your own it shows the built-in ones and offers to save your own.
  showQuotes: true,
};

export function normaliseDashboardSettings(raw) {
  const s = { ...DEFAULT_DASHBOARD_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.showQuotes = typeof s.showQuotes === "boolean" ? s.showQuotes : DEFAULT_DASHBOARD_SETTINGS.showQuotes;
  return s;
}

export function loadDashboardSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_DASHBOARD_SETTINGS };
  try {
    const raw = localStorage.getItem(DASHBOARD_SETTINGS_KEY);
    return normaliseDashboardSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_DASHBOARD_SETTINGS };
  }
}

/** Saves and tells every listener in this tab; returns the stored value. */
export function saveDashboardSettings(next) {
  const s = normaliseDashboardSettings(next);
  if (typeof window === "undefined") return s;
  try {
    localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. */
  }
  window.dispatchEvent(new CustomEvent(DASHBOARD_SETTINGS_EVENT, { detail: s }));
  return s;
}
