"use client";

// Presentational timer box shared by the signed-in timer, the navbar timer
// and the public one. The parent owns the countdown state machine; this
// renders the face and, under it, one slim glass bar with every control:
// the timing (focus + break as one control), the primary action, the rarely
// used tools (reset, restart) as small icons named in a tooltip, and "working
// on" when the screen passes `renderSession`:
//
//   [● Project › Task ▾ ……] [⏱ 25·5] | [Start] [tools]

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import TimerFace from "./TimerFace";
import DurationPicker from "./DurationPicker";

/* ── icons ─────────────────────────────────────────────── */

const IconPlay = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 001.53.85l10-6.5a1 1 0 000-1.7l-10-6.5A1 1 0 008 5.5z" />
  </svg>
);
const IconPause = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const IconReset = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const IconRestart = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 5v14" />
    <path d="M9 6.5v11a1 1 0 001.5.86l8.5-5.5a1 1 0 000-1.72l-8.5-5.5A1 1 0 009 6.5z" />
  </svg>
);
const IconCheck = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);
const IconCoffee = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2" />
  </svg>
);

const spring = { type: "spring", stiffness: 420, damping: 30 };

const TONES = {
  accent: "bg-accent hover:bg-accent-hover text-accent-fg",
  success: "bg-success hover:bg-success-hover text-white",
  warning: "bg-warning hover:bg-warning-hover text-white",
  primary: "bg-primary hover:bg-primary-hover text-primary-fg",
};
const glowOf = (tone) => `0 0 26px color-mix(in oklab, var(--${tone}) 42%, transparent)`;

/* ── what the buttons do in each state ─────────────────── */

function primaryAction(p) {
  if (!p.focusEnded) {
    if (p.isRunning) return { key: "pause", label: "Pause", short: "Pause", Icon: IconPause, tone: "warning", onClick: p.onPause };
    const resume = p.seconds < p.focusTime * 60;
    return { key: "start", label: resume ? "Resume focus" : "Start focus", short: resume ? "Resume" : "Start", Icon: IconPlay, tone: "accent", glow: true, onClick: p.onStart };
  }
  if (p.breakTime > 0 && !p.breakEnded) {
    if (p.isBreakRunning) return { key: "pause-break", label: "Pause break", short: "Pause", Icon: IconPause, tone: "warning", onClick: p.onPauseBreak };
    const resume = p.seconds < p.breakTime * 60;
    return { key: "break", label: resume ? "Resume break" : "Start break", short: resume ? "Resume" : "Break", Icon: IconCoffee, tone: "success", glow: true, onClick: p.onStartBreak };
  }
  return p.onFinish ? { key: "finish", label: p.finishLabel, short: "Finish", Icon: IconCheck, tone: "primary", onClick: p.onFinish } : null;
}

/** Finish once the focus is over (unless it already is the primary action). */
function finishAction(p, primary) {
  if (!p.focusEnded || !p.onFinish || primary?.key === "finish") return null;
  return { label: p.finishLabel, onClick: p.onFinish };
}

/* ── buttons ───────────────────────────────────────────── */

/** Small round tool with its name in a tooltip (reset, restart). */
function ToolButton({ label, onClick, tone = "neutral", children }) {
  const colours =
    tone === "danger"
      ? "text-fg-subtle hover:text-danger hover:bg-danger-soft hover:border-danger/40"
      : "text-fg-subtle hover:text-fg hover:bg-surface-hover";
  return (
    <span className="relative inline-flex group/tip">
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`w-8 h-8 grid place-items-center rounded-full border border-edge/70 bg-surface/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${colours}`}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        transition={spring}
      >
        {children}
      </motion.button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-edge bg-surface-2 px-2 py-1 text-[11px] font-medium text-fg opacity-0 shadow-lg transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-y-0 group-has-[:focus-visible]/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** Finish (once the focus is over), restart and reset. */
function tools(p, primary) {
  const list = [];
  const finish = finishAction(p, primary);
  if (finish) {
    list.push(
      <motion.button
          key="finish"
          type="button"
          onClick={finish.onClick}
          aria-label={finish.label}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-primary/40 bg-primary-soft text-primary text-xs font-semibold hover:bg-primary hover:text-primary-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
          whileTap={{ scale: 0.95 }}
          transition={spring}
        >
          <IconCheck className="w-3.5 h-3.5" /> Finish
        </motion.button>,
    );
  }
  if (p.focusLocked && p.onRestart && !p.focusEnded) {
    list.push(
      <ToolButton key="restart" label="Restart focus" onClick={p.onRestart}>
        <IconRestart />
      </ToolButton>,
    );
  }
  if (p.focusLocked && p.showReset) {
    list.push(
      <ToolButton key="reset" label="Reset timer" onClick={p.onReset} tone="danger">
        <IconReset />
      </ToolButton>,
    );
  }
  return list;
}

/** Pill-shaped primary button with its label. */
function PrimaryPill({ action, block = false, short = false }) {
  // In the bar (a size container) a narrow phone keeps only the icon.
  const pad = short ? "px-3 @min-[24rem]:px-4" : "px-5";
  if (!action) return null;
  const { Icon } = action;
  return (
    <motion.button
      type="button"
      onClick={action.onClick}
      aria-label={action.label}
      className={`inline-flex items-center justify-center gap-2 h-10 ${pad} rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${TONES[action.tone]} ${block ? "w-full" : ""}`}
      style={action.glow ? { boxShadow: glowOf(action.tone) } : undefined}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      layout
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={action.key}
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          <Icon />
          {short ? <span className="hidden @min-[24rem]:inline">{action.short}</span> : action.label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/* ── the bar ───────────────────────────────────────────── */

const Divider = () => <span className="w-px h-5 shrink-0 bg-edge/80" aria-hidden="true" />;

/** The row: "working on" first and taking the free width, then the controls. */
function ControlBar({ p, timing, primary, session }) {
  const right = tools(p, primary);
  const toolsGroup = right.length ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null;
  const play = <div className="shrink-0"><PrimaryPill action={primary} short /></div>;

  return (
    <motion.div
      layout
      className={`@container w-full ${session ? "max-w-[36rem]" : "max-w-[22rem]"} flex items-center gap-1 rounded-full border border-edge/70 bg-surface-2/50 p-1 backdrop-blur-md`}
      style={{ boxShadow: "inset 0 1px 0 color-mix(in oklab, var(--fg) 5%, transparent)" }}
    >
      {session ? (
        <>
          {session({ align: "start", grow: true })}
          {timing("center")}
          <Divider />
          {play}
          {toolsGroup}
        </>
      ) : (
        <>
          <div className="flex-1 flex justify-start">{timing("start")}</div>
          {play}
          <div className="flex-1 flex justify-end">{toolsGroup}</div>
        </>
      )}
    </motion.div>
  );
}

/* ── the panel ─────────────────────────────────────────── */

export default function TimerPanel(props) {
  const {
    settings,
    sounds,
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
    onFocusTime,
    onBreakTime,
    // A function ({ align, grow }) => node for the "working on" chip, or null.
    renderSession = null,
    extra = null,
  } = props;
  const p = { finishLabel: "Finish session", showReset: true, ...props };
  const format = settings?.timerFormat || "digital";
  const face = settings?.faceStyle || "ring";
  const running = phase === "break" ? !!isBreakRunning : !!isRunning;
  const done = phase === "focus" ? !!focusEnded : !!breakEnded;
  const tone = phase === "break" ? "success" : "accent";
  const primary = primaryAction(p);

  const timing = (align) => (
    <DurationPicker
      align={align}
      sounds={sounds}
      focusTime={focusTime}
      breakTime={breakTime}
      onFocusTime={onFocusTime}
      onBreakTime={onBreakTime}
      focusLocked={focusLocked}
      breakLocked={breakLocked}
    />
  );

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

      <div className="relative flex flex-col items-center gap-4 px-3 py-4 md:py-5">
        <TimerFace
          seconds={seconds}
          total={total}
          mode={phase}
          running={running}
          done={done && !running}
          format={format}
          style={face}
        />
        <ControlBar p={p} timing={timing} primary={primary} session={renderSession} />
        {extra}
      </div>
    </motion.div>
  );
}
