"use client";

// Small building blocks shared by the news briefing screens. Drawn with the
// app's theme tokens (bg-surface, text-fg-muted, border-edge, …) so they
// match the rest of PomoDRIVE in every theme.

import React from "react";

/* ── icons ─────────────────────────────────────────────── */

const icon = (path, extra = null) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
        {extra}
      </svg>
    );
  };

export const IconNews = icon(
  "M4 5h12a2 2 0 012 2v12a2 2 0 002-2V9M8 9h6M8 13h6M8 17h4",
  <path d="M4 5v14a2 2 0 002 2h14" />,
);
export const IconRefresh = icon("M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 6.3L4 9m0 6a8 8 0 0013.7 2.7L20 15");
export const IconSparkles = icon("M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9L5 17z");
export const IconBookmark = icon("M6 3h12v18l-6-4-6 4V3z");
export const IconThumbUp = icon("M7 11v10H3V11h4zm0 0l4-8a2 2 0 012 2v5h5a2 2 0 012 2.3l-1.2 7A2 2 0 0116.8 21H7");
export const IconThumbDown = icon("M17 13V3h4v10h-4zm0 0l-4 8a2 2 0 01-2-2v-5H6a2 2 0 01-2-2.3l1.2-7A2 2 0 017.2 3H17");
export const IconStar = icon("M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.6z");
export const IconEyeOff = icon("M3 3l18 18M10.6 10.6A2 2 0 0013.4 13.4M9.9 5.1A10.5 10.5 0 0112 5c5 0 9 4 10 7a11.4 11.4 0 01-2.4 3.5M6.6 6.6A11.5 11.5 0 002 12c1 3 5 7 10 7a9.8 9.8 0 004.3-1");
export const IconExternal = icon("M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5");
export const IconPlus = icon("M12 5v14M5 12h14");
export const IconX = icon("M6 6l12 12M18 6L6 18");
export const IconChat = icon("M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z");
export const IconClock = icon("M12 8v4l3 2", <circle cx="12" cy="12" r="9" />);
export const IconCheck = icon("M5 13l4 4L19 7");
export const IconAlert = icon("M12 9v4m0 4h.01M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z");
export const IconHistory = icon("M3 12a9 9 0 109-9 9.7 9.7 0 00-6.8 3M3 3v5h5M12 7v5l3 2");
export const IconTag = icon("M20 12l-8 8-9-9V4h7l10 8z", <circle cx="7.5" cy="7.5" r="1.2" />);
export const IconSettings = icon("M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z", <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />);
export const IconTrend = icon("M3 17l6-6 4 4 8-8M14 7h7v7");
export const IconGlobe = icon("M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18", <circle cx="12" cy="12" r="9" />);

/* ── controls ──────────────────────────────────────────── */

/** On/off switch drawn with the theme tokens (same look as Settings). */
export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:opacity-50 ${
        checked ? "bg-primary border-primary" : "bg-edge border-edge"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${
          checked ? "translate-x-5 bg-primary-fg" : "bg-surface"
        }`}
      />
    </button>
  );
}

export function SettingRow({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-sm text-fg">{title}</p>
        {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

const CHIP_TONES = {
  neutral: "bg-surface-2 border-edge text-fg-muted hover:border-edge-strong hover:text-fg",
  primary: "bg-primary-soft border-primary/40 text-primary",
  accent: "bg-accent-soft border-accent/40 text-accent",
  success: "bg-success-soft border-success/40 text-success",
};

export function Chip({ children, onClick, onRemove, tone = "neutral", title, disabled = false, Icon = null, removeLabel }) {
  const cls = `inline-flex items-center gap-1 max-w-full px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${CHIP_TONES[tone] || CHIP_TONES.neutral}`;
  const body = (
    <>
      {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-surface-hover text-fg-subtle hover:text-danger transition-colors"
          aria-label={removeLabel || `Remove ${typeof children === "string" ? children : "item"}`}
        >
          <IconX className="w-3 h-3" />
        </button>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${cls} disabled:opacity-50`}>
        {body}
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}

export function Spinner({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BUTTON_TONES = {
  primary: "bg-primary hover:bg-primary-hover text-primary-fg shadow-md shadow-primary/25",
  accent: "bg-accent hover:bg-accent-hover text-accent-fg shadow-md shadow-accent/25",
  outline: "border border-edge text-fg hover:bg-surface-hover",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-hover",
  danger: "bg-danger hover:bg-danger-hover text-white",
};

export function ActionButton({ children, onClick, tone = "outline", size = "md", disabled = false, busy = false, Icon = null, type = "button", className = "", title }) {
  const sizes = { sm: "px-2.5 py-1 text-xs gap-1", md: "px-3.5 py-1.5 text-sm gap-1.5", lg: "px-5 py-2.5 text-sm gap-2" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${sizes[size] || sizes.md} ${BUTTON_TONES[tone] || BUTTON_TONES.outline} ${className}`}
    >
      {busy ? <Spinner className="w-3.5 h-3.5" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

/** Section card, same shape as the dashboard cards. */
export function Card({ title, subtitle, Icon, action = null, children, className = "", bodyClassName = "px-4 py-4" }) {
  return (
    <section className={`bg-surface border border-edge rounded-2xl shadow-sm flex flex-col ${className}`}>
      {title ? (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-edge">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon ? (
              <span className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg leading-tight">{title}</h3>
              {subtitle ? <p className="text-[11px] text-fg-subtle">{subtitle}</p> : null}
            </div>
          </div>
          {action}
        </header>
      ) : null}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const BANNER_TONES = {
  danger: "bg-danger-soft border-danger/40 text-danger",
  warning: "bg-warning-soft border-warning/40 text-warning",
  success: "bg-success-soft border-success/40 text-success",
  info: "bg-primary-soft border-primary/30 text-fg",
};

export function Banner({ tone = "info", Icon = IconAlert, children, action = null }) {
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm ${BANNER_TONES[tone] || BANNER_TONES.info}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ Icon = IconNews, title, hint, action = null }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
      <span className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {hint ? <p className="text-xs text-fg-muted max-w-md">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ Icon, children, count }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
      {Icon ? (
        <span className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
      ) : null}
      {children}
      {typeof count === "number" ? <span className="text-xs font-medium text-fg-subtle tabular-nums">({count})</span> : null}
    </h2>
  );
}

/* ── formatting ────────────────────────────────────────── */

export function formatDate(value, { withTime = false } = {}) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString(undefined, opts);
}

export function relativeTime(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return formatDate(value);
}

export const KIND_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", custom: "Custom" };
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function statusTone(status) {
  return status === "ready" ? "success" : status === "generating" ? "primary" : status === "empty" ? "neutral" : "accent";
}
