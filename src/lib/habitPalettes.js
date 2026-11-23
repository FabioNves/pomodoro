// Habit color palettes (user-picked content colors; keep the Tailwind
// palette classes and their dark: variants as they are).

export const COLOR_PALETTES = {
  blue: {
    label: "Blue",
    swatch: "bg-blue-500",
    shades: [
      "bg-blue-100 dark:bg-blue-900/40",
      "bg-blue-200 dark:bg-blue-800/50",
      "bg-blue-400 dark:bg-blue-600/70",
      "bg-blue-500 dark:bg-blue-500",
      "bg-blue-700 dark:bg-blue-400",
    ],
  },
  green: {
    label: "Green",
    swatch: "bg-green-500",
    shades: [
      "bg-green-100 dark:bg-green-900/40",
      "bg-green-200 dark:bg-green-800/50",
      "bg-green-400 dark:bg-green-600/70",
      "bg-green-500 dark:bg-green-500",
      "bg-green-700 dark:bg-green-400",
    ],
  },
  red: {
    label: "Red",
    swatch: "bg-red-500",
    shades: [
      "bg-red-100 dark:bg-red-900/40",
      "bg-red-200 dark:bg-red-800/50",
      "bg-red-400 dark:bg-red-600/70",
      "bg-red-500 dark:bg-red-500",
      "bg-red-700 dark:bg-red-400",
    ],
  },
  orange: {
    label: "Orange",
    swatch: "bg-orange-500",
    shades: [
      "bg-orange-100 dark:bg-orange-900/40",
      "bg-orange-200 dark:bg-orange-800/50",
      "bg-orange-400 dark:bg-orange-600/70",
      "bg-orange-500 dark:bg-orange-500",
      "bg-orange-700 dark:bg-orange-400",
    ],
  },
  purple: {
    label: "Purple",
    swatch: "bg-purple-500",
    shades: [
      "bg-purple-100 dark:bg-purple-900/40",
      "bg-purple-200 dark:bg-purple-800/50",
      "bg-purple-400 dark:bg-purple-600/70",
      "bg-purple-500 dark:bg-purple-500",
      "bg-purple-700 dark:bg-purple-400",
    ],
  },
  yellow: {
    label: "Yellow",
    swatch: "bg-yellow-500",
    shades: [
      "bg-yellow-100 dark:bg-yellow-900/40",
      "bg-yellow-200 dark:bg-yellow-700/50",
      "bg-yellow-400 dark:bg-yellow-600/70",
      "bg-yellow-500 dark:bg-yellow-500",
      "bg-yellow-600 dark:bg-yellow-400",
    ],
  },
};

/* ── level shades (shared by the planner and the dashboard) ── */

export function getPalette(color) {
  return COLOR_PALETTES[color] || COLOR_PALETTES.blue;
}

// Index into a palette's shades for an auto-derived (non-manual) level color.
export function autoShadeIndex(value, maxLevel, shadeCount = 5) {
  if (!value) return 0;
  return Math.min(
    Math.round((value / maxLevel) * (shadeCount - 1)),
    shadeCount - 1,
  );
}

export function getShadeClass(color, level, maxLevel) {
  if (!level) return "bg-surface-2";
  const palette = getPalette(color);
  return palette.shades[autoShadeIndex(level, maxLevel, palette.shades.length)];
}

// Resolve the swatch class for a single level. When the level has an explicit
// color + shade (manually chosen by the user) it uses that; otherwise it falls
// back to the auto-derived shade of the habit color (legacy behaviour).
export function levelShadeClass(level, fallbackColor, maxLevel) {
  if (
    level &&
    level.color &&
    COLOR_PALETTES[level.color] &&
    typeof level.shade === "number"
  ) {
    const palette = COLOR_PALETTES[level.color];
    const idx = Math.min(Math.max(level.shade, 0), palette.shades.length - 1);
    return palette.shades[idx];
  }
  return getShadeClass(fallbackColor, level?.value, maxLevel);
}

