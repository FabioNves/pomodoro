export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} | ${hours}:${minutes}`;
};

export const formatDatee = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// ── Week-plan helpers ──────────────────────────────────
// Format a Date as a local YYYY-MM-DD string.
export const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Monday of the given date's week, as YYYY-MM-DD.
export const getMondayOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
};

// ISO-8601 week number (weeks start Monday, week 1 contains the first Thursday).
export const getISOWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday of the current week decides the year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
};

// Display label for a week plan, derived from its weekStart (YYYY-MM-DD).
export const weekLabel = (weekStart) =>
  `Week ${getISOWeek(new Date(`${weekStart}T00:00:00`))}`;

export const todayDate = new Date().toLocaleDateString();

export const yesterdayDate = new Date(
  new Date().setDate(new Date().getDate() - 1)
).toLocaleDateString();
