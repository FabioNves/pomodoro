"use client";

// Tells the desktop app when a newer build has been released.
//
// The frontend inside the desktop app is bundled at build time, so unlike the
// website it cannot update itself: server-side changes reach it immediately,
// but a new screen only arrives with a new install. This watches for that and
// points the user at the download.
//
// It checks on start, on window focus and every few hours, so a machine left
// running for days still notices. Nothing here downloads or installs; the
// link opens in the system browser.

import { useCallback, useEffect, useState } from "react";
import { apiUrl, getPlatform, openExternal } from "@/lib/platform";
import { isNewerVersion } from "@/lib/appVersion";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DISMISSED_KEY = "dismissedUpdateVersion";

export default function UpdateBanner() {
  const [release, setRelease] = useState(null);
  const [dismissed, setDismissed] = useState("");

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) || "");
    } catch {}
  }, []);

  const check = useCallback(async () => {
    // Only the packaged desktop app can be out of date this way.
    if (getPlatform() !== "electron") return;
    const current = window.pomodrive?.version;
    if (!current) return;
    try {
      const res = await fetch(apiUrl("/api/app/version"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const desktop = data?.desktop;
      if (desktop && isNewerVersion(desktop.version, current)) setRelease(desktop);
      else setRelease(null);
    } catch {
      // Offline or the site is down: stay quiet rather than nag.
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!release || dismissed === release.version) return null;

  const dismiss = () => {
    setDismissed(release.version);
    try {
      localStorage.setItem(DISMISSED_KEY, release.version);
    } catch {}
  };

  return (
    <div className="px-4 pt-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-2.5 shadow-sm">
        <span className="w-7 h-7 rounded-lg bg-accent text-accent-fg flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path d="M12 16V4M12 4L7 9M12 4l5 5M4 20h16" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            PomoDRIVE {release.version} is available
          </p>
          <p className="text-xs text-fg-muted">
            {release.notes || "Download the new version and run the installer to update."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openExternal(release.downloadUrl)}
            className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold transition-colors"
          >
            Download
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-2.5 py-1.5 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
