"use client";

// What a screen shows while it waits (for the signed-in user, the plan's
// verdict, a lazily loaded view): the tomato winding up like a kitchen
// timer, on a loop. It fades in after a moment, so a wait too short to
// notice does not flash it.
//
//   if (!hasMounted || !user) return <BrandLoader screen />;
//   <Suspense fallback={<BrandLoader />}>…</Suspense>

import React from "react";
import BrandLogo from "./BrandLogo";

export default function BrandLoader({ label = "Loading", screen = false, className = "" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pd-logo-loader flex flex-col items-center justify-center gap-3 ${
        screen ? "min-h-[60vh]" : "py-16"
      } ${className}`}
    >
      <BrandLogo layout="icon" motion="windup" loop title="" className="h-14 w-auto" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
