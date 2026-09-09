// Project header colours (user-picked content colours; keep the Tailwind
// palette classes and their dark: variants as they are).

export const PROJECT_COLORS = [
  {
    key: "blue",
    label: "Blue",
    swatchClass: "bg-blue-500",
    headerClass: "bg-blue-500/30 dark:bg-blue-400/25",
    borderClass: "border-blue-500/20 dark:border-blue-400/30",
  },
  {
    key: "green",
    label: "Green",
    swatchClass: "bg-green-500",
    headerClass: "bg-green-500/30 dark:bg-green-400/25",
    borderClass: "border-green-500/20 dark:border-green-400/30",
  },
  {
    key: "red",
    label: "Red",
    swatchClass: "bg-red-500",
    headerClass: "bg-red-500/30 dark:bg-red-400/25",
    borderClass: "border-red-500/20 dark:border-red-400/30",
  },
  {
    key: "orange",
    label: "Orange",
    swatchClass: "bg-orange-500",
    headerClass: "bg-orange-500/30 dark:bg-orange-400/25",
    borderClass: "border-orange-500/20 dark:border-orange-400/30",
  },
  {
    key: "purple",
    label: "Purple",
    swatchClass: "bg-purple-500",
    headerClass: "bg-purple-500/30 dark:bg-purple-400/25",
    borderClass: "border-purple-500/20 dark:border-purple-400/30",
  },
  {
    key: "gray",
    label: "Gray",
    swatchClass: "bg-gray-500",
    headerClass: "bg-gray-500/30 dark:bg-gray-400/25",
    borderClass: "border-gray-500/20 dark:border-gray-400/30",
  },
];

export function getProjectColorMeta(headerColor) {
  return PROJECT_COLORS.find((c) => c.key === headerColor) || PROJECT_COLORS[0];
}

/** Dropdown options for a list of projects, each with its colour dot. */
export function projectOptions(projects = []) {
  return projects.map((p) => ({
    value: String(p._id),
    label: p.name,
    colorClass: getProjectColorMeta(p.headerColor).swatchClass,
  }));
}
