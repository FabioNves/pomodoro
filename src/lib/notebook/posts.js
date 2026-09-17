// Saved posts: the rules shared by the API routes and the Saved posts view
// (platforms, media kinds, upload chunking). No server imports here.

/** Where a saved post came from. Order is the order of the filter chips. */
export const PLATFORMS = [
  { key: "instagram", label: "Instagram", hosts: ["instagram.com", "instagr.am"] },
  { key: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { key: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.watch"] },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { key: "x", label: "X", hosts: ["x.com", "twitter.com"] },
  { key: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pin.it"] },
  { key: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { key: "reddit", label: "Reddit", hosts: ["reddit.com", "redd.it"] },
  { key: "threads", label: "Threads", hosts: ["threads.net"] },
  { key: "other", label: "Other", hosts: [] },
];

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export function platformLabel(key) {
  return PLATFORMS.find((p) => p.key === key)?.label || "Other";
}

/** The platform a URL belongs to, or "other". */
export function detectPlatform(url) {
  let host = "";
  try {
    host = new URL(String(url || "").trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  for (const p of PLATFORMS) {
    if (p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return p.key;
  }
  return "other";
}

/** image | video | link */
export const POST_KINDS = ["image", "video", "link"];

export const POST_LIMITS = {
  title: 200,
  note: 2000,
  sourceUrl: 1000,
  tags: 12,
  tag: 40,
  fileName: 255,
};

/**
 * Files are uploaded in fixed-size pieces so each request stays far below
 * the request-body limit of serverless hosts (4.5 MB on Vercel) and every
 * piece fits in one MongoDB document. The server validates against this
 * same number.
 */
export const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024;

/** Media types the upload accepts; anything else is refused up front. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/heic", "image/heif", "image/bmp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg", "video/3gpp"];

const EXTENSION_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  "3gp": "video/3gpp",
};

/** The media type of a file, falling back to its extension when the browser gives none. */
export function mediaTypeOf(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const ext = String(file?.name || "").split(".").pop().toLowerCase();
  return EXTENSION_TYPES[ext] || "";
}

/** "image", "video" or null for a media type. */
export function mediaKindOf(mime) {
  const type = String(mime || "").toLowerCase();
  if (IMAGE_TYPES.includes(type)) return "image";
  if (VIDEO_TYPES.includes(type)) return "video";
  return null;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** A title from a file name: "IMG_2024 final.mp4" -> "IMG_2024 final". */
export function titleFromFileName(name) {
  return String(name || "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, POST_LIMITS.title);
}
