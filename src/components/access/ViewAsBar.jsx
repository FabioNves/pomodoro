"use client";

// The banner an admin sees while previewing the app as another role. The
// switcher itself lives in the account menu (src/components/nav/UserMenu.jsx);
// this is the standing reminder that what is on screen is not the admin
// view, and the one-click way out of it.

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAccess } from "@/lib/access/client";

function IconShield({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function ViewAsBar() {
  const { isAdmin, viewAs, setViewAs } = useAccess();
  const [busy, setBusy] = useState(false);
  if (!isAdmin || !viewAs) return null;

  const label = viewAs === "premium" ? "Premium" : "Free";

  const back = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setViewAs(null);
    } catch (error) {
      toast.error(error.message || "Could not leave the preview.");
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-2" data-testid="view-as-bar">
      <div
        className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/50 bg-warning-soft px-3 py-2 shadow-sm"
        role="status"
        aria-label="Previewing as another role"
      >
        <span className="w-7 h-7 rounded-lg bg-warning text-white flex items-center justify-center shrink-0">
          <IconShield />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Previewing as {label}</p>
          <p className="text-[11px] text-fg-muted leading-tight">
            Everything looks and behaves as a {label.toLowerCase()} user sees it.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={back}
          className="ml-auto px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold transition-colors disabled:opacity-60"
        >
          Back to admin
        </button>
      </div>
    </div>
  );
}
