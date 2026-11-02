"use client";

// The installed web app's launch screen: the tomato winding up, full screen,
// from the very first paint. It is part of the server HTML and moves by CSS
// alone (logoCss() keyframes), so it animates before any script has run, and
// it only shows in an installed app (display-mode: standalone; see
// .pd-launch in globals.css). The phone's own splash before it is drawn by
// the system from the manifest icon and cannot animate; this takes over the
// moment the page paints. Once the app has started it fades away.
//
// Mounted once in the root layout. A client-side navigation never re-renders
// it, so it shows on a launch or a full reload only.

import React, { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";

// Shown at least this long after the page started loading, so a fast start
// does not flash it.
const MIN_MS = 700;
const FADE_MS = 300;

export default function LaunchSplash() {
  const [phase, setPhase] = useState("shown"); // shown → fading → gone

  useEffect(() => {
    const fade = setTimeout(() => setPhase("fading"), Math.max(0, MIN_MS - performance.now()));
    return () => clearTimeout(fade);
  }, []);

  useEffect(() => {
    if (phase !== "fading") return undefined;
    const gone = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(gone);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className="pd-launch" data-fading={phase === "fading" ? "" : undefined} aria-hidden="true">
      <BrandLogo layout="icon" motion="windup" loop title="" className="h-24 w-auto" />
    </div>
  );
}
