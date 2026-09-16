// Week preferences, persisted per device in localStorage like the timer
// settings: which day a week starts on (planner weeks, the calendar and the
// dashboard all follow it). Safe to import on the server (no window access
// until a function runs in the browser).

export const WEEK_SETTINGS_KEY = "pomo.weekSettings";
export const WEEK_SETTINGS_EVENT = "pomo:week-settings";

export const WEEK_STARTS = [
  { id: "monday", name: "Monday", hint: "ISO weeks, Monday to Sunday" },
  { id: "sunday", name: "Sunday", hint: "Sunday to Saturday" },
];

export const DEFAULT_WEEK_SETTINGS = { weekStartsOn: "monday" };

export function normaliseWeekSettings(raw) {
  const s = { ...DEFAULT_WEEK_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!WEEK_STARTS.some((w) => w.id === s.weekStartsOn)) {
    s.weekStartsOn = DEFAULT_WEEK_SETTINGS.weekStartsOn;
  }
  return s;
}

export function loadWeekSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_WEEK_SETTINGS };
  try {
    const raw = localStorage.getItem(WEEK_SETTINGS_KEY);
    return normaliseWeekSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_WEEK_SETTINGS };
  }
}

/** Saves and broadcasts the change to every listener in this tab; returns the stored value. */
export function saveWeekSettings(next) {
  const s = normaliseWeekSettings(next);
  if (typeof window === "undefined") return s;
  try {
    localStorage.setItem(WEEK_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. */
  }
  window.dispatchEvent(new CustomEvent(WEEK_SETTINGS_EVENT, { detail: s }));
  return s;
}

/** "monday" | "sunday", read synchronously (for helpers called outside React). */
export function getWeekStartsOn() {
  return loadWeekSettings().weekStartsOn;
}
