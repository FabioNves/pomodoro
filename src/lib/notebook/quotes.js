// Quotes: the rules and helpers shared by the API routes, the notebook's
// Quotes view and the dashboard slot machine. No server imports here.

export const QUOTE_LIMITS = {
  text: 600,
  author: 120,
  source: 200,
  sourceUrl: 1000,
  perRequest: 50,
  suggestions: 20,
};

export const UNKNOWN_AUTHOR = "Unknown";

/** Normalised author name, so "marcus aurelius" and "Marcus Aurelius" match. */
export function authorKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Normalised quote text, for duplicate detection and verbatim checks. */
export function normalizeQuoteText(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Strips the quotation marks people paste around a quote. */
export function cleanQuoteText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“„«‹'‘]+\s*/u, "")
    .replace(/\s*["”«»›'’]+$/u, "")
    .trim();
}

export const ORIGIN_LABELS = {
  manual: "Added by you",
  ai: "Suggested by AI",
  web: "Found on the web",
};

/**
 * Quotes the dashboard falls back to while the notebook has no active
 * quotes of its own. Well-known lines with their usual attribution.
 */
export const DEFAULT_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "What we think, we become.", author: "Buddha" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Whether you think you can, or you think you can't, you're right.", author: "Henry Ford" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The best way out is always through.", author: "Robert Frost" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "The harder I work, the luckier I get.", author: "Samuel Goldwyn" },
  { text: "Either write something worth reading or do something worth writing.", author: "Benjamin Franklin" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "Perfection is not attainable, but if we chase perfection we can catch excellence.", author: "Vince Lombardi" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "Tomorrow belongs to those who prepare for it today.", author: "African proverb" },
];
