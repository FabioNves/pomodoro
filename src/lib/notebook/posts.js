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

/* ── embedding a link post ───────────────────────────── */

const YOUTUBE_ID = /^[\w-]{11}$/;

/** "1h2m3s", "90s" or "90" -> seconds, or 0. */
function startSeconds(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

function youtubeEmbed(url, host) {
  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  let vertical = false;
  if (host === "youtu.be") id = parts[0];
  else if (parts[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "live", "embed", "v"].includes(parts[0])) {
    id = parts[1];
    vertical = parts[0] === "shorts";
  }
  const list = url.searchParams.get("list");
  const params = new URLSearchParams({ rel: "0", autoplay: "1" });
  if (id && YOUTUBE_ID.test(id)) {
    const start = startSeconds(url.searchParams.get("t") || url.searchParams.get("start"));
    if (start) params.set("start", String(start));
    if (list) params.set("list", list);
    return {
      provider: "youtube",
      // The no-cookie host: nothing is stored until the reader presses play.
      src: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      ratio: vertical ? 9 / 16 : 16 / 9,
    };
  }
  if (list && /^[\w-]+$/.test(list)) {
    params.set("list", list);
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/videoseries?${params}`, thumb: null, ratio: 16 / 9 };
  }
  return null;
}

/**
 * How a link post plays inside the viewer, or null when its site has no
 * player we can frame (it then opens in the browser): `{ provider, src,
 * thumb, ratio }`, ratio being width / height. Every `src` host here must
 * also be allowed in the `frame-src` of next.config.mjs, and YouTube needs
 * the referrer fix in native/desktop/main.js to play in the desktop app.
 */
export function embedFor(sourceUrl) {
  let url;
  try {
    url = new URL(String(sourceUrl || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return youtubeEmbed(url, host);

  if (host === "vimeo.com" && /^\d+$/.test(parts[0] || "")) {
    // An unlisted video carries its key as the next segment.
    const key = /^[0-9a-f]+$/i.test(parts[1] || "") ? `&h=${parts[1]}` : "";
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${parts[0]}?autoplay=1${key}`, thumb: null, ratio: 16 / 9 };
  }

  if (host === "instagram.com" && ["p", "reel", "reels", "tv"].includes(parts[0]) && /^[\w-]+$/.test(parts[1] || "")) {
    const type = parts[0] === "p" ? "p" : "reel";
    // The embed page carries the account and the caption around the media.
    return { provider: "instagram", src: `https://www.instagram.com/${type}/${parts[1]}/embed/`, thumb: null, ratio: 0.62 };
  }

  // Short share links (vm.tiktok.com/…) only resolve on TikTok's side.
  if (host === "tiktok.com") {
    const at = parts.indexOf("video");
    const id = at >= 0 ? parts[at + 1] : null;
    if (id && /^\d+$/.test(id)) {
      return { provider: "tiktok", src: `https://www.tiktok.com/player/v1/${id}?autoplay=1`, thumb: null, ratio: 9 / 16 };
    }
  }
  return null;
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
