// Subjects for the Brain view: the suggestions every notebook starts with,
// the colours they can take and the few limits the API enforces. Pure
// constants and helpers, imported by both the API routes and the browser.

export const SUGGESTED_SUBJECTS = [
  "Ideas",
  "Projects",
  "Goals",
  "Learning",
  "Work",
  "Personal",
  "Health",
  "Finance",
  "Books",
  "Journal",
  "People",
  "Meetings",
];

// Mid-tone colours that read on both the light and the dark themes.
export const SUBJECT_COLORS = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#2dd4bf",
  "#38bdf8",
  "#f87171",
  "#a3e635",
  "#c084fc",
  "#fb7185",
];

export const MAX_SUBJECTS = 60;
export const MAX_VIEWS = 20;
export const SUBJECT_NAME_MAX = 40;
export const SUBJECTS_PER_NOTE = 20;

export const SUBJECT_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Normalised form used to de-duplicate subjects ("AI Notes" == "ai notes"). */
export function subjectKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** The first palette colour not in `taken`, or a stable pick once all are used. */
export function colorForSubject(name, taken = []) {
  const used = new Set(taken.map((c) => String(c).toLowerCase()));
  const free = SUBJECT_COLORS.find((c) => !used.has(c.toLowerCase()));
  if (free) return free;
  let hash = 0;
  for (const ch of subjectKey(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}
