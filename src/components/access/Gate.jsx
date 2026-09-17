"use client";

// Locked controls. A feature outside the user's plan is drawn, not hidden:
// greyed out, not interactive, with a small lock that links to /pricing.
// Nothing here stops a request; the API answers 403 on its own.

import React from "react";
import Link from "next/link";
import { useAccess, useFeatureGate } from "@/lib/access/client";

export function IconLock({ className = "w-3 h-3" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

const PREMIUM_TITLE = "Available on Premium. See pricing.";
const DISABLED_TITLE = "Currently unavailable.";

/** The small lock. Links to /pricing unless the feature is switched off. */
export function LockBadge({ disabled = false, label = null, className = "" }) {
  const cls = `inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
    disabled ? "border-edge text-fg-subtle" : "border-accent/40 bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg"
  } ${className}`;
  const body = (
    <>
      <IconLock className="w-3 h-3" />
      {label ?? (disabled ? "Off" : "Premium")}
    </>
  );
  if (disabled) {
    return (
      <span className={cls} title={DISABLED_TITLE}>
        {body}
      </span>
    );
  }
  return (
    <Link href="/pricing" className={cls} title={PREMIUM_TITLE} aria-label="Available on Premium. See pricing.">
      {body}
    </Link>
  );
}

/**
 * Wrap a control. When its feature is locked the control is greyed out and
 * inert, and a lock badge beside it leads to /pricing.
 *
 * @param {object} props
 * @param {string} props.feature registry key
 * @param {"inline"|"block"} [props.layout] block: the badge sits in the
 *   top-right corner over the greyed content (cards, panels)
 */
export function Locked({ feature, children, layout = "inline", className = "", badge = true }) {
  const { locked, disabled } = useFeatureGate(feature);
  if (!locked && !disabled) return children;
  const title = disabled ? DISABLED_TITLE : PREMIUM_TITLE;

  if (layout === "block") {
    return (
      <div className={`relative ${className}`} data-locked={feature} title={title}>
        <div aria-disabled="true" className="opacity-50 grayscale pointer-events-none select-none">
          {children}
        </div>
        {badge ? (
          <div className="absolute top-2 right-2">
            <LockBadge disabled={disabled} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 max-w-full ${className}`} data-locked={feature} title={title}>
      <span aria-disabled="true" className="inline-flex opacity-50 grayscale pointer-events-none select-none">
        {children}
      </span>
      {badge ? <LockBadge disabled={disabled} /> : null}
    </span>
  );
}

/**
 * A whole screen whose feature is locked: the page keeps its heading, shows
 * what is missing, and the content area is a greyed-out placeholder rather
 * than the live screen (which would only fail its requests).
 */
export function LockedScreen({ feature, title, description, children }) {
  const { locked, disabled } = useFeatureGate(feature);
  const { signedIn, me, loading } = useAccess();
  // Wait for the verdict before mounting the live screen, which would
  // otherwise start requests that a locked plan answers with 403.
  if (signedIn && !me && loading) return null;
  if (!locked && !disabled) return children;
  return (
    <div className="container mx-auto px-4 pb-12 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          {title}
        </h1>
        {description ? <p className="text-sm text-fg-muted mt-1">{description}</p> : null}
      </div>
      <div
        className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm mb-4 ${
          disabled ? "bg-surface-2 border-edge text-fg-muted" : "bg-accent-soft border-accent/40 text-fg"
        }`}
        role="status"
      >
        <IconLock className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {disabled ? (
            <p>This feature is currently unavailable.</p>
          ) : (
            <p>
              This feature is available on Premium.{" "}
              <Link href="/pricing" className="font-semibold text-accent hover:underline">
                See pricing
              </Link>
            </p>
          )}
        </div>
        <LockBadge disabled={disabled} />
      </div>
      <div
        aria-hidden="true"
        className="bg-surface/70 rounded-2xl border border-edge shadow-md p-4 sm:p-6 opacity-50 grayscale pointer-events-none select-none space-y-3"
      >
        <div className="h-8 w-2/3 rounded-lg bg-surface-2" />
        <div className="h-4 w-1/2 rounded bg-surface-2" />
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <div className="h-24 rounded-xl bg-surface-2" />
          <div className="h-24 rounded-xl bg-surface-2" />
          <div className="h-24 rounded-xl bg-surface-2" />
          <div className="h-24 rounded-xl bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
