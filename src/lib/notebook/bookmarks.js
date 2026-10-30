// Bookmarks: the posts someone saved on Instagram, brought in from the
// "Download your information" export. The rules shared by the API route and
// the Bookmarks view. No server imports here.

export const BOOKMARK_LIMITS = {
  caption: 2200, // Instagram's own caption limit
  ownerName: 120,
  ownerUsername: 60,
  // Posts sent per import request: keeps each body far below the 4.5 MB
  // serverless limit even when every caption is full length.
  batch: 250,
};

/**
 * The post a link points at, as `{ code, kind, url }` with `url` in one
 * canonical form, or null when it is not an Instagram post. Accepts
 * /p/CODE/, /reel/CODE/, /reels/CODE/, /tv/CODE/ and the newer
 * /username/p/CODE/ links.
 */
export function instagramPostRef(link) {
  let url;
  try {
    url = new URL(String(link || "").trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (host !== "instagram.com" && host !== "instagr.am") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
  const code = at >= 0 ? parts[at + 1] : null;
  if (!code || !/^[\w-]{5,64}$/.test(code)) return null;
  const kind = parts[at] === "p" ? "post" : "reel";
  return { code, kind, url: `https://www.instagram.com/${kind === "post" ? "p" : "reel"}/${code}/` };
}

/** The embed page of a post: Instagram's own player, meant for other sites. */
export function instagramEmbedUrl(bookmark) {
  return `https://www.instagram.com/${bookmark.kind === "post" ? "p" : "reel"}/${bookmark.code}/embed/`;
}

/**
 * Geometry of that embed page at EMBED_WIDTH px: a header bar of
 * EMBED_HEADER px (avatar, name, "View profile") and then the media, 4:5.
 * A gallery card frames just the media by shifting the page up.
 */
export const EMBED_WIDTH = 340;
export const EMBED_HEADER = 54;
export const EMBED_MEDIA_RATIO = 4 / 5;
