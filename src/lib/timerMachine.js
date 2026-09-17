// The timer's state machine and how it is stored. Shared with the browser.
//
// A run is kept as timestamps rather than as a countdown, so the time left is
// derived whenever anyone asks: moving to another page, reloading, or coming
// back to a throttled background tab all give the right number.
//
// `remaining` is the seconds left in the current phase as of `runningSince`;
// while the run is paused it is simply the seconds left. Nothing in here
// touches React or the network - src/components/timer/TimerProvider.jsx
// applies these transitions, persists the result and runs the effects.

export const TIMER_RUN_KEY = "pomo.timerRun";
// Which run has already been written to /api/sessions. Two tabs share one
// run, so both notice it end; only the first one through saves it.
const TIMER_SAVED_KEY = "pomo.timerSaved";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A fresh run, nothing started. */
export function blankRun({ focusMinutes = 25, breakMinutes = 5, context, owner = null } = {}) {
  return {
    id: newId(),
    // Whose run it is. A run is not picked up by whoever signs in next.
    owner,
    focusMinutes,
    breakMinutes,
    phase: "focus", // "focus" | "break"
    started: false, // the focus countdown has been started at least once
    focusEnded: false,
    breakStarted: false,
    running: false,
    remaining: focusMinutes * 60,
    runningSince: null, // epoch ms, only while running
    // What the session is saved against: the project picked when the run
    // started, kept up to date by whichever page is open.
    context: context || { projectId: "", title: "", tasks: [] },
    updatedAt: Date.now(),
  };
}

/** Seconds left in the current phase right now. */
export function secondsLeft(run, now = Date.now()) {
  if (!run) return 0;
  if (!run.running || !run.runningSince) return Math.max(0, run.remaining);
  return Math.max(0, run.remaining - Math.floor((now - run.runningSince) / 1000));
}

/** Seconds the current phase lasts in full, for the progress ring. */
export function phaseTotal(run) {
  if (!run) return 0;
  return (run.phase === "break" ? run.breakMinutes : run.focusMinutes) * 60;
}

/** True while a session is under way: started and not yet finished. */
export function isActiveRun(run) {
  return Boolean(run && (run.started || run.focusEnded));
}

const touch = (run) => ({ ...run, updatedAt: Date.now() });

/* ── transitions ──────────────────────────────────────── */

export function startFocus(run, now = Date.now()) {
  if (run.focusEnded) return run;
  return touch({ ...run, phase: "focus", started: true, running: true, runningSince: now });
}

export function pause(run, now = Date.now()) {
  if (!run.running) return run;
  return touch({ ...run, running: false, remaining: secondsLeft(run, now), runningSince: null });
}

/** Focus reached zero: move to the break phase, stopped. */
export function endFocus(run) {
  return touch({
    ...run,
    phase: "break",
    focusEnded: true,
    running: false,
    runningSince: null,
    remaining: run.breakMinutes * 60,
  });
}

export function startBreak(run, now = Date.now()) {
  if (!run.focusEnded || run.breakMinutes <= 0) return run;
  return touch({ ...run, phase: "break", breakStarted: true, running: true, runningSince: now });
}

/** Each length picker is locked once its own phase has begun. */
export function setFocusMinutes(run, minutes) {
  if (run.started || run.focusEnded) return run;
  return touch({ ...run, focusMinutes: minutes, remaining: minutes * 60 });
}

export function setBreakMinutes(run, minutes) {
  if (run.breakStarted) return run;
  const next = { ...run, breakMinutes: minutes };
  // The break countdown is only on screen once the focus has ended.
  if (run.phase === "break") next.remaining = minutes * 60;
  return touch(next);
}

export function withContext(run, context) {
  return touch({ ...run, context: { ...run.context, ...context } });
}

/* ── storage ──────────────────────────────────────────── */

function usable(run) {
  return Boolean(
    run &&
      typeof run === "object" &&
      Number.isFinite(run.focusMinutes) &&
      Number.isFinite(run.breakMinutes) &&
      Number.isFinite(run.remaining),
  );
}

export function loadRun() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw);
    return usable(run) ? { id: newId(), ...run } : null;
  } catch {
    return null;
  }
}

export function saveRun(run) {
  if (typeof window === "undefined") return run;
  try {
    localStorage.setItem(TIMER_RUN_KEY, JSON.stringify(run));
  } catch {
    /* private mode or quota: the timer still works in this tab */
  }
  return run;
}

export function clearRun() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TIMER_RUN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Take responsibility for writing this run's session. Returns false when
 * another tab already has, so a session is never saved twice.
 */
export function claimCompletion(run) {
  if (typeof window === "undefined" || !run?.id) return true;
  try {
    if (localStorage.getItem(TIMER_SAVED_KEY) === run.id) return false;
    localStorage.setItem(TIMER_SAVED_KEY, run.id);
  } catch {
    /* no storage: this tab is the only one that could be saving */
  }
  return true;
}
