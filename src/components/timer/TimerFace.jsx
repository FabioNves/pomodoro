"use client";

// The clock itself: digits + progress (ring / bar / minimal) with soft
// motion. Colours come from the theme tokens: accent for focus, success for
// break.

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { formatTimer } from "@/lib/timerSettings";

const RING_SIZE = 232;
const RING_STROKE = 9;

export default function TimerFace({
  seconds,
  total,
  mode = "focus", // "focus" | "break"
  running = false,
  done = false,
  format = "digital",
  style = "ring",
  updateTitle = true,
}) {
  const label = formatTimer(seconds, format);
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - seconds / total)) : 0;
  const tone = mode === "break" ? "success" : "accent";
  const color = `var(--${tone})`;

  // Keep the remaining time in the tab title while running.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!running || !updateTitle) return;
    const prev = document.title;
    document.title = `${formatTimer(seconds, "digital")} · ${mode === "break" ? "Break" : "Focus"} · PomoDRIVE`;
    return () => {
      document.title = prev;
    };
  }, [seconds, running, mode, updateTitle]);

  const digits = (
    <motion.div
      key={format}
      className={`font-bold tabular-nums tracking-tight leading-none text-fg ${
        style === "ring" ? "text-[2.75rem]" : "text-6xl md:text-7xl"
      }`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </motion.div>
  );

  if (style === "minimal") {
    return (
      <div className="flex flex-col items-center py-2" data-timer-face="minimal">
        {digits}
      </div>
    );
  }

  if (style === "bar") {
    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-4 py-2" data-timer-face="bar">
        {digits}
        <div className="w-full h-1.5 rounded-full bg-edge overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color, boxShadow: running ? `0 0 12px ${color}` : "none" }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.9, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      data-timer-face="ring"
    >
      {/* soft halo that breathes while running */}
      <motion.div
        className="absolute inset-3 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          running
            ? { opacity: [0.08, 0.18, 0.08], scale: [1, 1.04, 1] }
            : { opacity: done ? 0.14 : 0.06, scale: 1 }
        }
        transition={
          running ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }
        }
        aria-hidden="true"
      />
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={RING_STROKE}
          opacity="0.7"
        />
        {/* faint tick marks every 5 minutes-equivalent (12 marks) */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const cx = RING_SIZE / 2;
          const inner = r - RING_STROKE / 2 - 5;
          const outer = r - RING_STROKE / 2 - 1;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cx + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * outer}
              y2={cx + Math.sin(a) * outer}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
              opacity="0.6"
            />
          );
        })}
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ duration: 0.9, ease: "linear" }}
          style={{ filter: running ? `drop-shadow(0 0 6px ${color})` : "none" }}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1">
        {digits}
        <div className="text-[11px] uppercase tracking-[0.2em] text-fg-subtle">
          {done ? "done" : mode === "break" ? "break" : "focus"}
        </div>
      </div>
    </div>
  );
}
