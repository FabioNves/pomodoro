"use client";

// The PomoDRIVE logo, drawn inline in the colours of the current theme.
//
// Colours are CSS variables set per [data-theme] by logoCss() (in <head>, see
// the root layout), so the right logo shows from the first paint with no
// theme lookup here. `motion` plays one of LOGO_MOTIONS: once when the logo
// mounts (a screen opening), or on a loop while something loads. Reduced
// motion keeps it still.
//
//   <BrandLogo layout="horizontal" motion="bounce" className="h-7" />
//   <BrandLogo layout="icon" motion="windup" loop className="h-16" />

import React, { useId } from "react";
import { LAYOUTS, TOMATO } from "@/lib/brand/logoArt";
import { logoColor, partAnimation, partOrigin } from "@/lib/brand/logo";

export default function BrandLogo({
  layout = "icon",
  motion = null,
  loop = false,
  delay = 0,
  title = "PomoDRIVE",
  className = "",
  style,
}) {
  const L = LAYOUTS[layout] || LAYOUTS.icon;
  // Gradient ids must be unique per logo on the page; useId has colons.
  const uid = `pd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { k, tx, ty } = L.fit;

  const part = (name, children) => {
    const animation = partAnimation(motion, name, { loop, delay });
    return (
      <g style={animation ? { transformOrigin: partOrigin(name), animation } : undefined}>{children}</g>
    );
  };
  const gradient = (id, [x1, y1, x2, y2], hi, base) => (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
      <stop style={{ stopColor: logoColor(hi) }} />
      <stop offset="1" style={{ stopColor: logoColor(base) }} />
    </linearGradient>
  );

  return (
    <svg
      viewBox={`0 0 ${L.width} ${L.height}`}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      // A motion may move the tomato a little past its canvas.
      overflow="visible"
      className={`pd-logo block ${className}`}
      style={{ aspectRatio: `${L.width} / ${L.height}`, ...style }}
    >
      {L.pomo.map((d) => (
        <path key={d} d={d} style={{ fill: logoColor("pomo") }} />
      ))}
      {L.drive.map((d) => (
        <path key={d} d={d} style={{ fill: logoColor("drive") }} />
      ))}
      <g transform={`translate(${tx} ${ty}) scale(${k})`}>
        {part(
          "fruit",
          <>
            <path d={TOMATO.bottom} fill={`url(#${uid}-bottom)`} />
            {part(
              "lid",
              <>
                <path d={TOMATO.top} fill={`url(#${uid}-top)`} />
                {part("stem", <path d={TOMATO.stem} style={{ fill: logoColor("stem") }} />)}
              </>,
            )}
          </>,
        )}
      </g>
      <defs>
        {gradient(`${uid}-top`, TOMATO.topGradient, "topHi", "topBase")}
        {gradient(`${uid}-bottom`, TOMATO.bottomGradient, "bottomHi", "bottomBase")}
      </defs>
    </svg>
  );
}
