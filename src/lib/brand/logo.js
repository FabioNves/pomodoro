// The PomoDRIVE logo: its colours in every theme, its two motions, and the
// pieces built from them. Shared with the browser.
//
// - In the app, <BrandLogo> (src/components/brand) draws it inline; the root
//   layout puts logoCss() in <head>, so the colours follow [data-theme] from
//   the first paint (Dark when no theme is set) and the motions are ready
//   before hydration.
// - The files under public/logo/pomodrive-new/<theme>/ and the app icons are
//   built from the same data by scripts/build-logos.mjs (logoSvg()).

// With the extension: scripts/build-logos.mjs imports this under plain Node.
import { LAYOUTS, TOMATO } from "./logoArt.js";

/* ── colours ──────────────────────────────────────────── */

// Each role takes a token of the theme in src/app/globals.css: the tomato
// is --primary shaded from a highlight, the stem --accent, "POMO" --primary
// and "DRIVE" a quieter text token. Rose and Professional have no token
// lighter than --primary, so their highlights are --primary mixed with
// white (30% and 50%).
export const LOGO_PALETTES = {
  dark: {
    topHi: "#d3e7ee",
    topBase: "#abd1dc",
    bottomHi: "#e6f1f5",
    bottomBase: "#abd1dc",
    stem: "#dc602e",
    pomo: "#abd1dc",
    drive: "#7097a8",
    bg: "#15272d",
  },
  light: {
    topHi: "#2f4f58",
    topBase: "#1f363d",
    bottomHi: "#4a6772",
    bottomBase: "#1f363d",
    stem: "#dc602e",
    pomo: "#1f363d",
    drive: "#4a6772",
    bg: "#d3e7ee",
  },
  futuristic: {
    topHi: "#67e8f9",
    topBase: "#22d3ee",
    bottomHi: "#e8eefb",
    bottomBase: "#22d3ee",
    stem: "#a78bfa",
    pomo: "#22d3ee",
    drive: "#9fb0cc",
    bg: "#070a12",
  },
  rose: {
    topHi: "#d47da2",
    topBase: "#c2457a",
    bottomHi: "#e1a2bd",
    bottomBase: "#c2457a",
    stem: "#8b7bd1",
    pomo: "#c2457a",
    drive: "#7a5b69",
    bg: "#fbf3f6",
  },
  professional: {
    topHi: "#6283a1",
    topBase: "#1f4e79",
    bottomHi: "#8fa7bc",
    bottomBase: "#1f4e79",
    stem: "#0e7c86",
    pomo: "#1f4e79",
    drive: "#475467",
    bg: "#f4f6f9",
  },
};

export const DEFAULT_LOGO_THEME = "dark";
const ROLES = ["topHi", "topBase", "bottomHi", "bottomBase", "stem", "pomo", "drive"];
const cssVar = (role) => `--pd-logo-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/* ── motion ───────────────────────────────────────────── */

const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/** Keyframes [[time 0..1, value, easing into it], …] -> value at t. */
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      const [t1, v1, e = "inOut"] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return v0 + (v1 - v0) * ease[e]((t - t0) / (t1 - t0 || 1));
    }
    return keys[keys.length - 1][1];
  };
}

const bounceSy = track([[0, 1], [0.1, 0.92], [0.2, 1.04, "out"], [0.4, 1], [0.48, 1], [0.55, 0.9, "out"], [0.66, 1.03], [0.76, 1], [1, 1]]);

/**
 * Each motion moves three nested parts of the tomato (the whole fruit, its
 * top half or "lid", and the stem), in icon units, over one loop. Every
 * pose at t = 0 and t = 1 is the resting drawing, so a motion played once
 * ends exactly where the still logo is.
 */
export const LOGO_MOTIONS = {
  // Squash, hop, land, squash, settle; the stem springs behind. For a
  // screen opening.
  bounce: {
    seconds: 2.2,
    fruit: {
      y: track([[0, 0], [0.1, 0], [0.3, -5, "out"], [0.48, 0, "in"], [1, 0]]),
      sy: bounceSy,
      sx: (t) => 1 + (1 - bounceSy(t)) * 0.7, // keeps roughly the same volume
    },
    stem: {
      r: track([[0, 0], [0.1, 4], [0.22, -10, "out"], [0.4, 0], [0.48, 0], [0.56, 12, "out"], [0.66, -7], [0.76, 4], [0.86, -1.5], [0.94, 0], [1, 0]]),
    },
  },
  // A kitchen timer being wound: the top half clicks round three times,
  // springs back and the tomato rings. For waiting.
  windup: {
    seconds: 3.2,
    fruit: {
      x: track([[0, 0], [0.54, 0], [0.57, -1.6, "linear"], [0.6, 1.6, "linear"], [0.63, -1.2, "linear"], [0.66, 1, "linear"], [0.69, -0.5, "linear"], [0.72, 0, "linear"], [1, 0]]),
    },
    lid: {
      // Lifted enough that the deepest click never closes the gap between
      // the halves (an edge 50 units out drops sin(6°)·50 ≈ 5.2).
      y: track([[0, 0], [0.06, -3.5, "out"], [0.5, -3.5], [0.56, 0, "in"], [1, 0]]),
      r: track([[0, 0], [0.08, 0], [0.11, -2, "out"], [0.2, -2], [0.23, -4, "out"], [0.32, -4], [0.35, -6, "out"], [0.48, -6], [0.54, 2.5, "out"], [0.6, -1.2], [0.66, 0.5], [0.72, 0], [1, 0]]),
    },
    stem: {
      r: track([[0, 0], [0.11, -5, "out"], [0.15, 0], [0.23, -5, "out"], [0.27, 0], [0.35, -5, "out"], [0.39, 0], [0.48, 0], [0.54, 10, "out"], [0.62, -5], [0.7, 2], [0.76, 0], [1, 0]]),
    },
  },
};

export const LOGO_MOTION_NAMES = Object.keys(LOGO_MOTIONS);
const PARTS = ["fruit", "lid", "stem"];

/** Where each part turns and scales from, in icon units. */
export const LOGO_PIVOTS = { fruit: [61.3, 99.1], lid: [61.3, 61], stem: [59.5, 34] };

const n3 = (v) => Number(v.toFixed(3));

/** The pose of one part at time t (0..1), in icon units. `hop` scales the fruit's rise. */
export function logoPose(motion, part, t, hop = 1) {
  const m = LOGO_MOTIONS[motion]?.[part] || {};
  return {
    x: n3(m.x ? m.x(t) : 0),
    y: n3((m.y ? m.y(t) : 0) * (part === "fruit" ? hop : 1)),
    r: n3(m.r ? m.r(t) : 0),
    sx: n3(m.sx ? m.sx(t) : 1),
    sy: n3(m.sy ? m.sy(t) : 1),
  };
}

/** The parts a motion actually moves. */
export function movingParts(motion) {
  return PARTS.filter((part) => LOGO_MOTIONS[motion]?.[part]);
}

/** The name of the @keyframes moving `part` in `motion`. */
export const keyframesName = (motion, part, prefix = "pd-logo") => `${prefix}-${motion}-${part}`;

/** @keyframes for every moving part of every motion, sampled `steps` times a loop. */
export function logoKeyframesCss({ steps = 48, hop = 1, prefix = "pd-logo", motions = LOGO_MOTION_NAMES } = {}) {
  const out = [];
  for (const motion of motions) {
    for (const part of movingParts(motion)) {
      const frames = [];
      for (let i = 0; i <= steps; i += 1) {
        const p = logoPose(motion, part, i / steps, hop);
        frames.push(`${n3((i / steps) * 100)}%{transform:translate(${p.x}px,${p.y}px) rotate(${p.r}deg) scale(${p.sx},${p.sy})}`);
      }
      out.push(`@keyframes ${keyframesName(motion, part, prefix)}{${frames.join("")}}`);
    }
  }
  return out.join("\n");
}

/** The CSS `animation` of one part, or undefined when the motion leaves it still. */
export function partAnimation(motion, part, { loop = false, delay = 0, prefix = "pd-logo" } = {}) {
  if (!motion || !LOGO_MOTIONS[motion]?.[part]) return undefined;
  const { seconds } = LOGO_MOTIONS[motion];
  return `${keyframesName(motion, part, prefix)} ${seconds}s linear ${delay}s ${loop ? "infinite" : 1}`;
}

/** `transform-origin` of a part, in icon units. */
export const partOrigin = (part) => `${LOGO_PIVOTS[part][0]}px ${LOGO_PIVOTS[part][1]}px`;

/* ── the app's stylesheet ─────────────────────────────── */

/**
 * Everything <BrandLogo> needs, for the root layout's <head>: the colour
 * variables (Dark by default, then one block per theme), the motions, and
 * the loader's fade-in. Reduced motion stops every logo where it rests.
 */
export function logoCss() {
  const vars = (palette) => ROLES.map((role) => `${cssVar(role)}:${palette[role]}`).join(";");
  const themes = Object.entries(LOGO_PALETTES)
    .filter(([id]) => id !== DEFAULT_LOGO_THEME)
    .map(([id, palette]) => `[data-theme="${id}"] .pd-logo{${vars(palette)}}`);
  return [
    `.pd-logo{${vars(LOGO_PALETTES[DEFAULT_LOGO_THEME])}}`,
    ...themes,
    logoKeyframesCss(),
    "@keyframes pd-logo-fade-in{from{opacity:0}to{opacity:1}}",
    ".pd-logo-loader{animation:pd-logo-fade-in .3s ease-out .2s both}",
    "@media (prefers-reduced-motion:reduce){.pd-logo *{animation:none!important}}",
  ].join("\n");
}

/** `var(--pd-logo-…)` for a colour role, for the inline drawing. */
export const logoColor = (role) => `var(${cssVar(role)})`;

/* ── standalone files ─────────────────────────────────── */

const attrTransform = (p, [ox, oy]) =>
  `translate(${n3(ox + p.x)} ${n3(oy + p.y)}) rotate(${p.r}) scale(${p.sx} ${p.sy}) translate(${n3(-ox)} ${n3(-oy)})`;

/**
 * A complete SVG file of the logo in one theme's colours.
 *
 *   layout      "icon" | "horizontal" | "stacked"
 *   background  fill the canvas with the theme's background
 *   motion      a LOGO_MOTIONS name: animated with CSS, looping
 *   at          with `motion`, a still frame at that point of the loop (0..1)
 *   hop         how high the bounce rises (files have no room to overflow)
 *   frame       { size, pad, radius }: draw the icon on a square tile instead
 *               of its own canvas (app icons)
 */
export function logoSvg({ layout = "icon", theme = DEFAULT_LOGO_THEME, background = false, motion = null, at = null, hop = 1, frame = null }) {
  const L = LAYOUTS[layout];
  const c = LOGO_PALETTES[theme] || LOGO_PALETTES[DEFAULT_LOGO_THEME];
  const id = `pd-${theme}-${layout}${motion ? `-${motion}` : ""}${background ? "-bg" : ""}`;
  let { width, height } = L;
  let { k, tx, ty } = L.fit;
  let bg = background ? `<rect width="${width}" height="${height}" fill="${c.bg}"/>` : "";
  if (frame) {
    // The tomato centred on a square tile, `pad` of it left around the art
    // (the art spans x 11..111.6, y 22..99.1 in icon units).
    const { size, pad = 0.18, radius = 0 } = frame;
    width = size;
    height = size;
    k = (size * (1 - 2 * pad)) / 100.6;
    tx = size / 2 - k * 61.3;
    ty = size / 2 - k * 60.5;
    bg = background ? `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${c.bg}"/>` : "";
  }

  const still = at != null;
  const cls = (part) => `${id}-${part}`;
  const g = (part, inner) => {
    if (!motion || !LOGO_MOTIONS[motion][part]) return `<g>${inner}</g>`;
    if (still) return `<g transform="${attrTransform(logoPose(motion, part, at, hop), LOGO_PIVOTS[part])}">${inner}</g>`;
    return `<g class="${cls(part)}">${inner}</g>`;
  };

  let style = "";
  if (motion && !still) {
    const prefix = id;
    const rules = movingParts(motion).map(
      (part) =>
        `.${cls(part)}{transform-origin:${partOrigin(part)};animation:${keyframesName(motion, part, prefix)} ${LOGO_MOTIONS[motion].seconds}s linear infinite}`,
    );
    const moving = movingParts(motion).map((part) => `.${cls(part)}`).join(",");
    style = `<style>\n${rules.join("\n")}\n${logoKeyframesCss({ steps: 60, hop, prefix, motions: [motion] })}\n@media (prefers-reduced-motion:reduce){${moving}{animation:none}}\n</style>`;
  }

  const [t1, t2] = [TOMATO.topGradient, TOMATO.bottomGradient];
  const grad = (name, [x1, y1, x2, y2], hi, base) =>
    `<linearGradient id="${id}-${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${hi}"/><stop offset="1" stop-color="${base}"/></linearGradient>`;

  return [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    style,
    bg,
    ...(frame ? [] : L.pomo.map((d) => `<path d="${d}" fill="${c.pomo}"/>`)),
    ...(frame ? [] : L.drive.map((d) => `<path d="${d}" fill="${c.drive}"/>`)),
    `<g transform="translate(${n3(tx)} ${n3(ty)}) scale(${k})">`,
    g(
      "fruit",
      `<path d="${TOMATO.bottom}" fill="url(#${id}-bottom)"/>${g(
        "lid",
        `<path d="${TOMATO.top}" fill="url(#${id}-top)"/>${g("stem", `<path d="${TOMATO.stem}" fill="${c.stem}"/>`)}`,
      )}`,
    ),
    "</g>",
    `<defs>${grad("top", t1, c.topHi, c.topBase)}${grad("bottom", t2, c.bottomHi, c.bottomBase)}</defs>`,
    "</svg>",
  ]
    .filter(Boolean)
    .join("\n");
}
