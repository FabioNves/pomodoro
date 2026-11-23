"use client";

// Focus and break lengths as one control rather than two pills: a trigger
// that reads "25 · 5" and a small panel with both sets of presets.

import React, { useRef, useState } from "react";
import TimerPopover, { MicroLabel } from "./TimerPopover";
import { BREAK_PRESETS, FOCUS_PRESETS } from "@/lib/timerSettings";

const IconClock = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 1.5M9 2h6" />
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

const minutesLabel = (m) => (m === 0 ? "None" : `${m}`);

function PresetRow({ label, tone, presets, value, onChange, locked, min, max, unitHint }) {
  const [custom, setCustom] = useState("");
  const isCustom = !presets.includes(value);
  const commitCustom = () => {
    const n = Math.round(Number(custom));
    if (Number.isFinite(n) && custom !== "") onChange(Math.max(min, Math.min(max, n)));
    setCustom("");
  };
  const on = tone === "success" ? "bg-success text-white border-success" : "bg-accent text-accent-fg border-accent";
  return (
    <div className={locked ? "opacity-60" : ""}>
      <div className="flex items-center justify-between mb-1.5">
        <MicroLabel className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${tone === "success" ? "bg-success" : "bg-accent"}`} aria-hidden="true" />
          {label}
        </MicroLabel>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-fg-subtle"><IconLock /> Locked this session</span>
        ) : (
          <span className="text-[10px] text-fg-subtle">{unitHint}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${label} length`}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value === p}
            disabled={locked}
            onClick={() => onChange(p)}
            className={`min-w-8 h-8 px-1.5 rounded-lg border text-xs font-semibold tabular-nums transition-colors disabled:cursor-not-allowed ${
              value === p ? on : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-hover"
            }`}
          >
            {minutesLabel(p)}
          </button>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          disabled={locked}
          value={custom}
          placeholder={isCustom ? String(value) : "…"}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCustom();
          }}
          aria-label={`Custom ${label.toLowerCase()} minutes`}
          className={`w-11 h-8 px-1 rounded-lg border bg-transparent text-xs font-semibold text-center tabular-nums outline-none focus:border-focus [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none placeholder:text-fg-subtle disabled:cursor-not-allowed ${
            isCustom ? (tone === "success" ? "border-success text-success" : "border-accent text-accent") : "border-edge text-fg"
          }`}
        />
      </div>
    </div>
  );
}

export function DurationPanel({ focusTime, breakTime, onFocusTime, onBreakTime, focusLocked, breakLocked }) {
  return (
    <div className="w-[20.5rem] p-3.5 space-y-3.5">
      <PresetRow label="Focus" tone="accent" presets={FOCUS_PRESETS} value={focusTime} onChange={onFocusTime} locked={focusLocked} min={1} max={180} unitHint="minutes" />
      <PresetRow label="Break" tone="success" presets={BREAK_PRESETS} value={breakTime} onChange={onBreakTime} locked={breakLocked} min={0} max={60} unitHint="minutes" />
    </div>
  );
}

/** The trigger ("⏱ 25 · 5") + panel. */
export default function DurationPicker({ align = "center", sounds, ...panel }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const { focusTime, breakTime } = panel;
  const summary = `Focus ${focusTime} minutes, break ${breakTime ? `${breakTime} minutes` : "none"}`;
  const toggle = () => {
    if (!open) sounds?.click?.();
    setOpen((o) => !o);
  };
  const classes = `shrink-0 inline-flex items-center gap-1.5 h-9 px-2 @min-[24rem]:px-2.5 rounded-full text-xs font-semibold tabular-nums transition-colors ${open ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-hover"}`;
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        className={`${classes} focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Timing: ${summary}. Change`}
        title="Focus and break length"
      >
        <IconClock className="hidden @min-[24rem]:block w-3.5 h-3.5" />
        <span className="text-accent">{focusTime}</span>
        <span className="text-fg-subtle">·</span>
        <span className="text-success">{breakTime || "–"}</span>
      </button>
      <TimerPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} align={align} label="Timing">
        <DurationPanel {...panel} />
      </TimerPopover>
    </>
  );
}
