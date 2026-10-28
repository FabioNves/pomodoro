"use client";

// The shared timer is available without leaving the current page.

import React, { useEffect, useState } from "react";
import TimerModal from "./TimerModal";
import { usePathname } from "next/navigation";
import { formatTimer } from "@/lib/timerSettings";
import { useTimerDisplay } from "@/components/timer/TimerProvider";

export default function TimerBadge({ className = "" }) {
  const { run, seconds, active, ready } = useTimerDisplay();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const onBreak = run.phase === "break";
  const paused = active && !run.running;
  const label = onBreak ? "Break" : "Focus";
  const tone = onBreak ? "text-success" : "text-accent";
  // Already on the dashboard: the panel is right there, so this is a status
  // read-out rather than a link.
  const here = pathname === "/dashboard";

  const body = (
    <>
      <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
        {active && !paused ? (
          <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${onBreak ? "bg-success" : "bg-accent"}`} />
        ) : null}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${paused ? "bg-fg-subtle" : onBreak ? "bg-success" : "bg-accent"}`} />
      </span>
      <span className={`tabular-nums font-semibold ${tone}`}>{active ? formatTimer(seconds, "digital") : "Focus"}</span>
      {active ? <span className="hidden lg:inline text-fg-muted">{paused ? `${label} paused` : label}</span> : null}
    </>
  );

  const classes = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-edge bg-surface-2/80 text-xs transition-colors ${className}`;
  const title = `${paused ? `${label} paused` : `${label} running`} · ${formatTimer(seconds, "verbose")} left`;

  if (here && !active) return null;
  if (here) {
    return (
      <span className={classes} title={title} aria-label={title} data-testid="timer-badge">
        {body}
      </span>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={!ready} className={`${classes} hover:border-edge-strong`} title={active ? `${title} · open timer` : "Open focus timer"} aria-label="Open focus timer" aria-haspopup="dialog" aria-expanded={open} data-testid="timer-badge">
        {body}
      </button>
      {open ? <TimerModal open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
