// The briefing kinds and the time window each one covers.
//
// One definition shared by retrieval, the AI layer, the scheduler and the UI,
// so a window is never hard-coded in two places. Safe to import from client
// components: nothing here touches the database or the network.

export const BRIEFING_KINDS = {
  daily: {
    key: "daily",
    label: "Daily",
    window: "day",
    // How far back searches reach, and how old a story may be before it is
    // dropped. The second is looser because search engines are inexact about
    // recency and a same-story follow-up is still worth reading.
    recencyDays: 2,
    maxAgeDays: 4,
    // "brief" = top stories and trends. "roundup" = also biggest
    // developments, grouped, plus what you may have missed.
    format: "brief",
    periodWords: "the past 24 to 48 hours",
  },
  weekly: {
    key: "weekly",
    label: "Weekly",
    window: "week",
    recencyDays: 7,
    maxAgeDays: 10,
    format: "roundup",
    periodWords: "the past 7 days",
  },
  monthly: {
    key: "monthly",
    label: "Monthly",
    window: "month",
    recencyDays: 31,
    maxAgeDays: 38,
    format: "roundup",
    periodWords: "the past month",
  },
  custom: {
    key: "custom",
    label: "Custom",
    window: "day",
    recencyDays: 2,
    maxAgeDays: 4,
    format: "brief",
    periodWords: "the past 24 to 48 hours",
  },
};

export const KIND_KEYS = Object.keys(BRIEFING_KINDS);
/** The kinds a user can ask for directly, in the order the UI shows them. */
export const SELECTABLE_KINDS = ["daily", "weekly", "monthly"];
/** The kinds the scheduler can deliver on its own. */
export const SCHEDULED_KINDS = ["daily", "weekly", "monthly", "custom"];

export function kindMeta(kind) {
  return BRIEFING_KINDS[kind] || BRIEFING_KINDS.daily;
}

export function isRoundup(kind) {
  return kindMeta(kind).format === "roundup";
}

/** How many searches a briefing of this kind is allowed to run. */
export function maxQueriesFor(kind) {
  return { daily: 12, custom: 12, weekly: 16, monthly: 20 }[kind] || 12;
}

/**
 * How many retrieved items reach the model. A longer window surfaces far
 * more material, and the whole point of the longer window is that the model
 * picks the important few out of it, so the pool grows with the window.
 */
export function candidateLimitFor(kind, storyCount) {
  const meta = kindMeta(kind);
  if (meta.window === "month") return Math.min(70, Math.max(30, storyCount * 6));
  if (meta.window === "week") return Math.min(48, Math.max(20, storyCount * 4));
  return Math.min(36, Math.max(15, storyCount * 3));
}
