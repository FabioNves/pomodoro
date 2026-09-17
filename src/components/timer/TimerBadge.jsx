"use client";

// The running session, in the navbar. It only appears once a session is
// under way, and it is the way back to the timer now that the timer lives on
// the dashboard rather than in the menu.

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatTimer } from "@/lib/timerSettings";
import { useTimerDisplay } from "@/components/timer/TimerProvider";

export default function TimerBadge({ className = "" }) {
  const { run, seconds, active, ready } = useTimerDisplay();
  const pathname = usePathname();
  if (!ready || !active) return null;

  const onBreak = run.phase === "break";
  const paused = !run.running;
  const label = onBreak ? "Break" : "Focus";
  const tone = onBreak ? "text-success" : "text-accent";
  // Already on the dashboard: the panel is right there, so this is a status
  // read-out rather than a link.
  const here = pathname === "/dashboard";

  const body = (
    <>
      <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
        {!paused ? (
          <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${onBreak ? "bg-success" : "bg-accent"}`} />
        ) : null}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${paused ? "bg-fg-subtle" : onBreak ? "bg-success" : "bg-accent"}`} />
      </span>
      <span className={`tabular-nums font-semibold ${tone}`}>{formatTimer(seconds, "digital")}</span>
      <span className="hidden lg:inline text-fg-muted">{paused ? `${label} paused` : label}</span>
    </>
  );

  const classes = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-edge bg-surface-2/80 text-xs transition-colors ${className}`;
  const title = `${paused ? `${label} paused` : `${label} running`} · ${formatTimer(seconds, "verbose")} left`;

  if (here) {
    return (
      <span className={classes} title={title} aria-label={title} data-testid="timer-badge">
        {body}
      </span>
    );
  }
  return (
    <Link href="/dashboard" className={`${classes} hover:border-edge-strong`} title={`${title} · open the dashboard`} data-testid="timer-badge">
      {body}
    </Link>
  );
}
