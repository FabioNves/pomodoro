// Timer personalisation, persisted per device in localStorage.

export const TIMER_SETTINGS_KEY = "pomo.timerSettings";
export const TIMER_SETTINGS_EVENT = "pomo:timer-settings";

export const ALARM_SOUNDS = [
  { id: "futuristic", name: "Futuristic", hint: "The classic PomoDRIVE alarm" },
  { id: "chime", name: "Chime", hint: "Soft three-note bell" },
  { id: "digital", name: "Digital", hint: "Short electronic beeps" },
  { id: "none", name: "Silent", hint: "Notification only" },
];

export const TIMER_FORMATS = [
  { id: "digital", name: "Digital", example: "24:59" },
  { id: "verbose", name: "Verbose", example: "24m 59s" },
  { id: "compact", name: "Minutes", example: "25m" },
];

export const FACE_STYLES = [
  { id: "ring", name: "Ring", hint: "Progress ring around the clock" },
  { id: "bar", name: "Bar", hint: "Slim progress line" },
  { id: "minimal", name: "Minimal", hint: "Just the digits" },
];

export const FOCUS_PRESETS = [15, 20, 25, 30, 45, 50, 60];
export const BREAK_PRESETS = [0, 5, 10, 15, 20];

export const DEFAULT_TIMER_SETTINGS = {
  soundEnabled: true,
  volume: 0.6, // 0..1
  alarmSound: "futuristic",
  uiSounds: true, // clicks, start/pause cues
  tickSound: false, // soft tick during the last 10 seconds
  timerFormat: "digital",
  faceStyle: "ring",
  defaultFocus: 25,
  defaultBreak: 5,
  autoStartBreak: false,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Merge a stored object with the defaults and drop invalid values. */
export function normaliseTimerSettings(raw) {
  const s = { ...DEFAULT_TIMER_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.soundEnabled = !!s.soundEnabled;
  s.uiSounds = !!s.uiSounds;
  s.tickSound = !!s.tickSound;
  s.autoStartBreak = !!s.autoStartBreak;
  s.volume = clamp(Number(s.volume) || 0, 0, 1);
  if (!ALARM_SOUNDS.some((a) => a.id === s.alarmSound))
    s.alarmSound = DEFAULT_TIMER_SETTINGS.alarmSound;
  if (!TIMER_FORMATS.some((f) => f.id === s.timerFormat))
    s.timerFormat = DEFAULT_TIMER_SETTINGS.timerFormat;
  if (!FACE_STYLES.some((f) => f.id === s.faceStyle))
    s.faceStyle = DEFAULT_TIMER_SETTINGS.faceStyle;
  s.defaultFocus = clamp(Math.round(Number(s.defaultFocus) || 25), 1, 180);
  s.defaultBreak = clamp(Math.round(Number(s.defaultBreak) || 0), 0, 60);
  return s;
}

export function loadTimerSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_TIMER_SETTINGS };
  try {
    const raw = localStorage.getItem(TIMER_SETTINGS_KEY);
    return normaliseTimerSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_TIMER_SETTINGS };
  }
}

export function saveTimerSettings(settings) {
  if (typeof window === "undefined") return;
  const next = normaliseTimerSettings(settings);
  try {
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent(TIMER_SETTINGS_EVENT, { detail: next }));
  return next;
}

/** Format a number of seconds according to the chosen timer format. */
export function formatTimer(totalSeconds, format = "digital") {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (format === "compact") {
    if (s < 60) return `${s}s`;
    const mins = Math.ceil(s / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
  if (format === "verbose") {
    if (h) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${pad(sec)}s`;
  }
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
