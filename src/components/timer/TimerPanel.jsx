"use client";

// Presentational timer box shared by the signed-in timer and the public one.
// The parent owns the countdown state machine; this renders the face, the
// duration pickers and the controls with soft motion.

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import TimerFace from "./TimerFace";
import Dropdown from "@/components/ui/Dropdown";
import { BREAK_PRESETS, FOCUS_PRESETS } from "@/lib/timerSettings";

const minuteOptions = (presets) =>
  presets.map((p) => ({ value: p, label: `${p} min`, shortLabel: `${p}m` }));
const FOCUS_OPTIONS = minuteOptions(FOCUS_PRESETS);
const BREAK_OPTIONS = minuteOptions(BREAK_PRESETS);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 001.53.85l10-6.5a1 1 0 000-1.7l-10-6.5A1 1 0 008 5.5z" />
  </svg>
);
const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const IconReset = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);
const IconCoffee = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2" />
  </svg>
);

const spring = { type: "spring", stiffness: 420, damping: 30 };

function ActionButton({ variant = "primary", glow = false, children, ...rest }) {
  const base =
    "inline-flex items-center gap-2 rounded-full font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "px-4 sm:px-7 py-2.5 sm:py-3 text-sm sm:text-base bg-accent hover:bg-accent-hover text-accent-fg",
    warning:
      "px-4 sm:px-7 py-2.5 sm:py-3 text-sm sm:text-base bg-warning hover:bg-warning-hover text-white",
    success:
      "px-4 sm:px-6 py-2.5 sm:py-3 text-sm bg-success hover:bg-success-hover text-white",
    secondary:
      "px-4 sm:px-6 py-2.5 sm:py-3 text-sm bg-primary hover:bg-primary-hover text-primary-fg",
    ghost:
      "px-4 sm:px-5 py-2.5 sm:py-3 text-sm bg-surface/70 hover:bg-surface-hover text-fg-muted hover:text-fg border border-edge",
    danger:
      "px-4 sm:px-5 py-2.5 sm:py-3 text-sm bg-surface/70 hover:bg-danger-soft text-fg-muted hover:text-danger border border-edge",
  };
  return (
    <motion.button
      type="button"
      className={`${base} ${variants[variant]}`}
      style={glow ? { boxShadow: "0 0 28px color-mix(in oklab, var(--accent) 45%, transparent)" } : undefined}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      layout
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export default function TimerPanel({
  settings,
  sounds,
  // state
  phase = "focus", // "focus" | "break"
  seconds,
  total,
  isRunning,
  isBreakRunning,
  focusEnded,
  breakEnded = false,
  focusTime,
  breakTime,
  focusLocked,
  breakLocked,
  // handlers
  onFocusTime,
  onBreakTime,
  onStart,
  onPause,
  onReset,
  onStartBreak,
  onPauseBreak,
  onFinish,
  finishLabel = "Finish session",
  extra = null,
}) {
  const format = settings?.timerFormat || "digital";
  const face = settings?.faceStyle || "ring";
  const running = phase === "break" ? !!isBreakRunning : !!isRunning;
  const done = phase === "focus" ? !!focusEnded : !!breakEnded;
  const tone = phase === "break" ? "success" : "accent";

  return (
    <motion.div
      className="timer-section relative w-full overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(60% 55% at 50% 30%, color-mix(in oklab, var(--${tone}) 14%, transparent) 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center gap-5 px-3 py-4 md:py-5">
        <TimerFace
          seconds={seconds}
          total={total}
          mode={phase}
          running={running}
          done={done && !running}
          format={format}
          style={face}
        />

        {/* controls: primary action, focus / break lengths, reset */}
        <motion.div layout className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {!focusEnded ? (
              <motion.div
                key="focus-controls"
                className="flex items-center gap-2 sm:gap-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {isRunning ? (
                  <ActionButton variant="warning" onClick={onPause} aria-label="Pause focus">
                    <IconPause /> Pause
                  </ActionButton>
                ) : (
                  <ActionButton variant="primary" glow onClick={onStart} aria-label="Start focus">
                    <IconPlay /> {seconds < focusTime * 60 ? "Resume" : "Start focus"}
                  </ActionButton>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="break-controls"
                className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {breakTime > 0 && !breakEnded ? (
                  isBreakRunning ? (
                    <ActionButton variant="warning" onClick={onPauseBreak} aria-label="Pause break">
                      <IconPause /> Pause break
                    </ActionButton>
                  ) : (
                    <ActionButton variant="success" onClick={onStartBreak} aria-label="Start break">
                      <IconCoffee /> {seconds < breakTime * 60 ? "Resume break" : "Start break"}
                    </ActionButton>
                  )
                ) : null}
                {onFinish ? (
                  <ActionButton variant="secondary" onClick={onFinish}>
                    <IconCheck /> {finishLabel}
                  </ActionButton>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
          <Dropdown
            id="focus-length"
            label="Focus"
            value={focusTime}
            options={FOCUS_OPTIONS}
            onChange={onFocusTime}
            tone="accent"
            custom={{ min: 1, max: 180, unit: "min", label: "Custom" }}
            compact
            align="center"
            disabled={focusLocked}
            onOpen={sounds?.click}
          />
          <Dropdown
            id="break-length"
            label="Break"
            value={breakTime}
            options={BREAK_OPTIONS}
            onChange={onBreakTime}
            tone="success"
            custom={{ min: 0, max: 60, unit: "min", label: "Custom" }}
            compact
            align="center"
            disabled={breakLocked}
            onOpen={sounds?.click}
          />

          {/* Reset only matters once a session is under way */}
          <AnimatePresence initial={false}>
            {focusLocked ? (
              <motion.div
                key="reset"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <ActionButton variant="danger" onClick={onReset} aria-label="Reset timer">
                  <IconReset /> Reset
                </ActionButton>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {extra}
      </div>
    </motion.div>
  );
}
