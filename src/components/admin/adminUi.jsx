"use client";

// Small pieces the admin sections share: tables, stat tiles, inputs and
// icons, drawn with the same tokens as the rest of the app.

import React from "react";

export const inputClass =
  "px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none disabled:opacity-50";

const icon = (path, extra = null) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d={path} />
        {extra}
      </svg>
    );
  };

export const IconPlug = icon("M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4");
export const IconChart = icon("M4 20V10M10 20V4M16 20v-7M22 20H2");
export const IconUsers = icon("M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8", <circle cx="9" cy="7" r="4" />);
export const IconCard = icon("M2 10h20M6 15h4", <rect x="2" y="5" width="20" height="14" rx="2" />);
export const IconShield = icon("M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3zM9 12l2 2 4-4");

export function Table({ columns, children, minWidth = "40rem", caption }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-edge bg-surface">
      <table className="w-full text-sm" style={{ minWidth }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-surface-2/70">
            {columns.map((c) => (
              <th
                key={typeof c === "string" ? c : c.key}
                scope="col"
                className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle whitespace-nowrap border-b border-edge ${
                  typeof c !== "string" && c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {typeof c === "string" ? c : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, className = "" }) {
  return <tr className={`border-b border-edge last:border-b-0 hover:bg-surface-hover/50 transition-colors ${className}`}>{children}</tr>;
}

export function Td({ children, className = "", align = "left", colSpan }) {
  return (
    <td colSpan={colSpan} className={`px-3 py-2 align-middle text-fg ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-fg-subtle">
        {children}
      </td>
    </tr>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }) {
  const tones = {
    neutral: "text-fg",
    primary: "text-primary",
    accent: "text-accent",
    success: "text-success",
  };
  return (
    <div className="rounded-xl border border-edge bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight mt-0.5 ${tones[tone] || tones.neutral}`}>{value}</p>
      {hint ? <p className="text-[11px] text-fg-muted mt-0.5">{hint}</p> : null}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex items-center gap-1 bg-surface-2/80 px-1 py-1 rounded-lg border border-edge" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              active ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusDot({ ok, className = "" }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-success" : "bg-danger"} ${className}`} aria-hidden="true" />;
}

const numberFormat = new Intl.NumberFormat(undefined);

export function formatNumber(n) {
  return numberFormat.format(Number(n) || 0);
}

export function formatMoney(n, currency = "USD") {
  const value = Number(n) || 0;
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return `${currency} ${value.toFixed(digits)}`;
  }
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function relativeTime(value) {
  if (!value) return "never";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return formatDay(value);
}
