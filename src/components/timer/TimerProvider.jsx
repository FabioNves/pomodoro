"use client";

// The running timer, for the whole app.
//
// Mounted once in the root layout, so a focus session keeps going while the
// user moves between the dashboard, the planner and everything else, and
// survives a reload: the run is stored as timestamps (src/lib/timerMachine.js)
// and the time left is derived from the clock.
//
// It owns the effects that used to sit next to the countdown: the alarm, the
// notification when a phase ends, the automatic break, and writing the
// finished session to /api/sessions. Pages say what the session is about
// through setSessionContext(); they no longer own the countdown.
//
// Two contexts on purpose. The display one changes twice a second, so only
// the timer panel and the navbar badge read it; pages take the control one,
// which changes only when something actually happens.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTimerSettings } from "@/hooks/useTimerSettings";
import { createSoundKit } from "@/utils/sounds";
import { apiJson } from "@/utils/apiClient";
import { showNotification } from "@/utils/notifications";
import {
  TIMER_RUN_KEY,
  blankRun,
  claimCompletion,
  clearRun,
  endFocus,
  isActiveRun,
  loadRun,
  pause as pauseRun,
  phaseTotal,
  saveRun,
  secondsLeft,
  setBreakMinutes as setBreakMinutesOn,
  setFocusMinutes as setFocusMinutesOn,
  startBreak as startBreakOn,
  startFocus as startFocusOn,
  withContext,
} from "@/lib/timerMachine";

const TimerDisplayContext = createContext(null);
const TimerControlContext = createContext(null);

// Twice a second: the face never shows a stale number, and only the couple
// of components that read the display re-render.
const TICK_MS = 500;
const NO_PROJECT_LABEL = "Unassigned";
// Older than this and a stored run is dropped rather than resumed.
const STALE_RUN_MS = 12 * 60 * 60 * 1000;

/** Who is signed in on this device, or null. */
function currentOwner() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("userId");
  } catch {
    return null;
  }
}

/** One task of a saved session, in the shape /api/sessions validates. */
function sessionTask(task, label) {
  const text = String(task?.task || "").trim();
  return {
    ...(text ? { task: text.slice(0, 200) } : {}),
    completed: Boolean(task?.completed),
    brand: { title: label },
  };
}

export function TimerProvider({ children }) {
  const { settings, ready } = useTimerSettings();
  const sounds = useMemo(() => createSoundKit(settings), [settings]);

  const [run, setRunState] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  // Bumped whenever a session is written, so pages can refresh their lists.
  const [completedAt, setCompletedAt] = useState(0);

  // Actions read the current run from here, so every one of them is stable
  // and a page can depend on them without re-running its effects.
  const runRef = useRef(null);
  const soundsRef = useRef(sounds);
  const settingsRef = useRef(settings);
  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const commit = useCallback((next) => {
    if (!next) return null;
    const owned = { ...next, owner: currentOwner() };
    runRef.current = owned;
    setRunState(owned);
    saveRun(owned);
    return owned;
  }, []);

  /* ── hydrate ────────────────────────────────────────── */
  // One effect, so a stored run can never be overwritten by a blank one.
  useEffect(() => {
    if (!ready || runRef.current) return;
    const stored = loadRun();
    // A run left behind hours ago is not resumed: it would alarm and save a
    // session the moment the app opened. Nor is one belonging to whoever
    // used this browser before.
    const usable =
      stored && stored.owner === currentOwner() && Date.now() - (stored.updatedAt || 0) < STALE_RUN_MS ? stored : null;
    const next =
      usable || blankRun({ focusMinutes: settings.defaultFocus, breakMinutes: settings.defaultBreak, owner: currentOwner() });
    runRef.current = next;
    setRunState(next);
  }, [ready, settings.defaultFocus, settings.defaultBreak]);

  // Changing the defaults in Settings moves an idle timer with them.
  useEffect(() => {
    const current = runRef.current;
    if (!current || isActiveRun(current)) return;
    if (current.focusMinutes === settings.defaultFocus && current.breakMinutes === settings.defaultBreak) return;
    commit({ ...setFocusMinutesOn(current, settings.defaultFocus), breakMinutes: settings.defaultBreak });
  }, [settings.defaultFocus, settings.defaultBreak, commit]);

  /* ── another tab ────────────────────────────────────── */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TIMER_RUN_KEY) return;
      const next = loadRun();
      runRef.current = next;
      setRunState(next);
      setNow(Date.now());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ── tick ───────────────────────────────────────────── */
  const running = Boolean(run?.running);
  useEffect(() => {
    if (!running) return undefined;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, TICK_MS);
    // A background tab is throttled, so catch up the moment it is seen again.
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [running]);

  const liveSeconds = run ? secondsLeft(run, now) : 0;

  /* ── saving a finished session ──────────────────────── */
  const completeSession = useCallback(async (finished) => {
    if (!finished || !claimCompletion(finished)) return;
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    // Signed out there is nothing to save against; the timer still runs.
    if (!userId) return;

    const label = finished.context?.title || NO_PROJECT_LABEL;
    const list = finished.context?.tasks || [];
    const named = list.map((t) => String(t?.task || "").trim()).filter(Boolean);
    const on = named.length ? `${named[0]} · ${label}` : label;

    try {
      await apiJson("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          focusTime: finished.focusMinutes,
          breakTime: finished.breakMinutes,
          currentProject: { title: label },
          tasks: list.map((t) => sessionTask(t, label)),
        }),
      });
      toast.success(`Saved a ${finished.focusMinutes}-minute session on ${on}.`);
      showNotification("🎯 Session Completed!", {
        body: `Great work! You completed a ${finished.focusMinutes}-minute focus session on ${on}.`,
        icon: "/favicon.ico",
      });
      setCompletedAt(Date.now());
    } catch (error) {
      console.error("Error saving session", error);
      toast.error(error?.message || "Could not save the session.");
    }
  }, []);

  /** A fresh run, keeping the chosen break length and the project. */
  const freshRun = useCallback((from) => {
    const s = settingsRef.current;
    return blankRun({
      focusMinutes: s.defaultFocus,
      breakMinutes: from?.breakMinutes ?? s.defaultBreak,
      context: from?.context,
      owner: currentOwner(),
    });
  }, []);

  /* ── the last ten seconds ───────────────────────────── */
  // The kit itself decides whether the tick is switched on; this only makes
  // sure it plays once a second rather than once a tick.
  const lastTickRef = useRef(null);
  useEffect(() => {
    if (!runRef.current?.running || liveSeconds > 10 || liveSeconds <= 0) {
      lastTickRef.current = null;
      return;
    }
    if (lastTickRef.current === liveSeconds) return;
    lastTickRef.current = liveSeconds;
    soundsRef.current.tick();
  }, [liveSeconds]);

  /* ── phase endings ──────────────────────────────────── */
  useEffect(() => {
    const current = runRef.current;
    if (!current || !current.running || liveSeconds > 0) return;

    if (current.phase === "focus") {
      // The alarm first, so a notification problem cannot silence it.
      soundsRef.current.alarm();
      const ended = endFocus(current);
      const auto = settingsRef.current.autoStartBreak && ended.breakMinutes > 0;
      commit(auto ? startBreakOn(ended) : ended);
      if (auto) soundsRef.current.breakStart();
      showNotification("🎉 Focus Session Complete!", {
        body: auto
          ? `Nice work. Your ${ended.breakMinutes}-minute break has started.`
          : `Great job! You completed ${current.focusMinutes} minutes of focused work.`,
        icon: "/favicon.ico",
      });
      return;
    }

    // The break is over: save the session and start again from idle.
    soundsRef.current.stopAlarm();
    soundsRef.current.alarm();
    commit(freshRun(current));
    completeSession(current);
  }, [liveSeconds, commit, completeSession, freshRun]);

  /* ── actions ────────────────────────────────────────── */
  const controls = useMemo(() => {
    const on = (fn) => () => {
      const current = runRef.current;
      if (current) commit(fn(current));
    };
    return {
      start: on((r) => {
        soundsRef.current.start();
        return startFocusOn(r);
      }),
      pause: on((r) => {
        soundsRef.current.pause();
        return pauseRun(r);
      }),
      startBreak: on((r) => {
        soundsRef.current.breakStart();
        soundsRef.current.stopAlarm();
        return startBreakOn(r);
      }),
      pauseBreak: on((r) => {
        soundsRef.current.pause();
        return pauseRun(r);
      }),
      reset: on((r) => {
        soundsRef.current.click();
        soundsRef.current.stopAlarm();
        return freshRun(r);
      }),
      /** Finish now: save what was done and go back to idle. */
      finish() {
        const current = runRef.current;
        if (!current) return;
        soundsRef.current.click();
        soundsRef.current.stopAlarm();
        commit(freshRun(current));
        completeSession(current);
      },
      setFocusMinutes(minutes) {
        const current = runRef.current;
        if (current) commit(setFocusMinutesOn(current, minutes));
      },
      setBreakMinutes(minutes) {
        const current = runRef.current;
        if (current) commit(setBreakMinutesOn(current, minutes));
      },
      /**
       * What the next saved session is about. Pages call this while they are
       * open; it is stored with the run, so the session is still saved
       * correctly whatever page the user is on when it ends.
       */
      setSessionContext(context) {
        const current = runRef.current;
        if (!current) return;
        const next = { ...current.context, ...context };
        if (JSON.stringify(next) === JSON.stringify(current.context)) return;
        commit(withContext(current, context));
      },
      /** Forget the run entirely, e.g. on sign-out. */
      clear() {
        clearRun();
        runRef.current = null;
        setRunState(null);
      },
    };
  }, [commit, completeSession, freshRun]);

  const controlValue = useMemo(() => ({ ...controls, completedAt }), [controls, completedAt]);

  const displayValue = useMemo(() => {
    // Before hydration the panel shows the saved defaults rather than nothing.
    const shown = run || blankRun({ focusMinutes: settings.defaultFocus, breakMinutes: settings.defaultBreak });
    return {
      ready: Boolean(run),
      run: shown,
      seconds: run ? liveSeconds : shown.remaining,
      total: phaseTotal(shown),
      phase: shown.phase,
      active: isActiveRun(shown),
      settings,
      sounds,
    };
  }, [run, liveSeconds, settings, sounds]);

  return (
    <TimerControlContext.Provider value={controlValue}>
      <TimerDisplayContext.Provider value={displayValue}>{children}</TimerDisplayContext.Provider>
    </TimerControlContext.Provider>
  );
}

/** The countdown as it stands. Re-renders twice a second while running. */
export function useTimerDisplay() {
  const ctx = useContext(TimerDisplayContext);
  if (!ctx) throw new Error("useTimerDisplay must be used inside TimerProvider");
  return ctx;
}

/**
 * Starting, pausing and describing the session. Stable between renders, so
 * a page can register its project without re-rendering on every tick.
 */
export function useTimerControls() {
  const ctx = useContext(TimerControlContext);
  if (!ctx) throw new Error("useTimerControls must be used inside TimerProvider");
  return ctx;
}
