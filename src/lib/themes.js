// Theme registry. Each theme maps to a `[data-theme="<id>"]` block in
// globals.css. `dark` marks dark-based themes: they also get the `.dark`
// class on <html> so the Tailwind `dark:` variant keeps working for
// user-picked content colors (project/habit palettes).

export const THEMES = [
  {
    id: "light",
    name: "Light",
    tagline: "Pale sky & jet black",
    dark: false,
    preview: {
      bg: "#d3e7ee",
      surface: "#ffffff",
      primary: "#1f363d",
      accent: "#dc602e",
    },
  },
  {
    id: "dark",
    name: "Dark",
    tagline: "Jet black & pale sky",
    dark: true,
    preview: {
      bg: "#15272d",
      surface: "#1f363d",
      primary: "#abd1dc",
      accent: "#dc602e",
    },
  },
  {
    id: "futuristic",
    name: "Futuristic",
    tagline: "Deep space, cyan & violet",
    dark: true,
    preview: {
      bg: "#070a12",
      surface: "#0f1523",
      primary: "#22d3ee",
      accent: "#a78bfa",
    },
  },
  {
    id: "feminine",
    name: "Feminine",
    tagline: "Blush, rose & lavender",
    dark: false,
    preview: {
      bg: "#fbf3f6",
      surface: "#ffffff",
      primary: "#c2457a",
      accent: "#8b7bd1",
    },
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Slate, navy & teal",
    dark: false,
    preview: {
      bg: "#f4f6f9",
      surface: "#ffffff",
      primary: "#1f4e79",
      accent: "#0e7c86",
    },
  },
];

export const DEFAULT_THEME = "dark";
export const THEME_IDS = THEMES.map((t) => t.id);
export const DARK_THEME_IDS = THEMES.filter((t) => t.dark).map((t) => t.id);

export function getTheme(id) {
  return (
    THEMES.find((t) => t.id === id) ||
    THEMES.find((t) => t.id === DEFAULT_THEME)
  );
}

export function isValidTheme(id) {
  return THEME_IDS.includes(id);
}

/** Apply a theme to <html>: data-theme attribute + `.dark` class. */
export function applyTheme(id) {
  if (typeof document === "undefined") return;
  const theme = getTheme(id);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.classList.toggle("dark", theme.dark);
}
