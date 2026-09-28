// Dashboard preferences, persisted per device in localStorage like the timer
// and week settings. Safe to import on the server (no window access until a
// function runs in the browser).

export const DASHBOARD_SETTINGS_KEY = "pomo.dashboardSettings";
export const DASHBOARD_SETTINGS_EVENT = "pomo:dashboard-settings";

/** How the dashboard shows the quotes: one at random per pull, or in order. */
export const QUOTE_VIEWS = [
  { id: "slot", name: "Slot machine", hint: "Pull the lever for a quote at random" },
  { id: "gallery", name: "Gallery", hint: "Step through your quotes one by one" },
];

export const DEFAULT_DASHBOARD_SETTINGS = {
  // The quotes under the greeting: your own active quotes from the notebook,
  // never anyone else's. On by default.
  showQuotes: true,
  // Slot machine or gallery; the switch on the dashboard sets it too.
  quotesView: "slot",
};

export function normaliseDashboardSettings(raw) {
  const s = { ...DEFAULT_DASHBOARD_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.showQuotes = typeof s.showQuotes === "boolean" ? s.showQuotes : DEFAULT_DASHBOARD_SETTINGS.showQuotes;
  if (!QUOTE_VIEWS.some((v) => v.id === s.quotesView)) s.quotesView = DEFAULT_DASHBOARD_SETTINGS.quotesView;
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
