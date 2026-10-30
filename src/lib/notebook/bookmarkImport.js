// Reads an Instagram "Download your information" export in the browser and
// returns the saved posts in it. Takes the ZIP as Instagram delivers it, or
// the saved_posts.html / saved_posts.json inside it. Browser only: it uses
// DOMParser and DecompressionStream. Only the list of posts goes to the
// server, never the file.

import { BOOKMARK_LIMITS, instagramPostRef } from "./bookmarks";

/* ── zip ───────────────────────────────────────────────── */

const ZIP_END = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

async function bytesOf(file, start, end) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

/**
 * The text of the first entry whose name passes `match`, or null. Reads only
 * the directory and that entry, so a full export of several GB costs no more
 * than a small one.
 */
async function readZipEntry(file, match) {
  const tailStart = Math.max(0, file.size - 65557);
  const tail = await bytesOf(file, tailStart, file.size);
  let end = -1;
  for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
    if (tail.getUint32(i, true) === ZIP_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("That file is not a ZIP archive.");
  const count = tail.getUint16(end + 10, true);
  const dirSize = tail.getUint32(end + 12, true);
  const dirStart = tail.getUint32(end + 16, true);
  if (dirStart === 0xffffffff || count === 0xffff) {
    throw new Error("That export is too large to read here. Request it again with only “Saved” selected.");
  }

  const dir = await bytesOf(file, dirStart, dirStart + dirSize);
  const decoder = new TextDecoder();
  let p = 0;
  for (let n = 0; n < count && p + 46 <= dir.byteLength; n += 1) {
    if (dir.getUint32(p, true) !== ZIP_CENTRAL) break;
    const method = dir.getUint16(p + 10, true);
    const compressed = dir.getUint32(p + 20, true);
    const nameLength = dir.getUint16(p + 28, true);
    const extraLength = dir.getUint16(p + 30, true);
    const commentLength = dir.getUint16(p + 32, true);
    const offset = dir.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    if (!match(name)) continue;

    const local = await bytesOf(file, offset, offset + 30);
    if (local.getUint32(0, true) !== ZIP_LOCAL) throw new Error("The ZIP archive is damaged.");
    const start = offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    const data = file.slice(start, start + compressed);
    if (method === 0) return data.text();
    if (method === 8) {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("This browser cannot open ZIP files. Unzip it and drop saved_posts.html instead.");
      }
      return new Response(data.stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    throw new Error("The ZIP archive uses a compression this page cannot read. Unzip it and drop saved_posts.html instead.");
  }
  return null;
}

/* ── shared clean-up ───────────────────────────────────── */

/**
 * Meta's JSON exports spell UTF-8 bytes as \u00xx characters ("Ã©" for
 * "é"). Undo that when a string looks like it; leave real text alone.
 */
function fixMojibake(text) {
  const s = String(text || "");
  if (!/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Oct 29, 2026 2:06 pm" (the HTML export, local time) -> Date, or null. */
function parseExportDate(text) {
  const m = /^([a-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i.exec(String(text || "").trim());
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month >= 0) {
      const hour = (Number(m[4]) % 12) + (m[6].toLowerCase() === "p" ? 12 : 0);
      return new Date(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
    }
  }
  return null;
}

function cleanItem({ link, caption, ownerName, ownerUsername, savedAt }) {
  const ref = instagramPostRef(link);
  if (!ref) return null;
  return {
    url: ref.url,
    caption: String(caption || "").trim().slice(0, BOOKMARK_LIMITS.caption),
    ownerName: String(ownerName || "").trim().slice(0, BOOKMARK_LIMITS.ownerName),
    ownerUsername: String(ownerUsername || "").trim().replace(/^@/, "").slice(0, BOOKMARK_LIMITS.ownerUsername),
    savedAt: savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt.toISOString() : null,
  };
}

/* ── HTML export ───────────────────────────────────────── */

// Each saved post is one block under <main>: a table with a URL cell (the
// link to the post), "Caption" rows, an "Owner" table (URL, Name,
// Username) and the date it was saved under the table. The class names are
// generated, so this goes by the labels instead.
function parseHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const main = doc.querySelector("main") || doc.body;
  const items = [];
  for (const block of main.children) {
    const link = [...block.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .find((href) => instagramPostRef(href));
    if (!link) continue;
    const fields = {};
    for (const row of block.querySelectorAll("tr")) {
      if (row.children.length !== 2) continue;
      const label = row.children[0].textContent.trim();
      if (label && !(label in fields)) fields[label] = row.children[1].textContent;
    }
    let savedAt = null;
    for (const el of block.querySelectorAll("div")) {
      if (el.children.length) continue;
      savedAt = parseExportDate(el.textContent) || savedAt;
    }
    items.push(
      cleanItem({ link, caption: fields.Caption, ownerName: fields.Name, ownerUsername: fields.Username, savedAt }),
    );
  }
  return items;
}

/* ── JSON export ───────────────────────────────────────── */

// Two shapes are in circulation: the older
//   { saved_saved_media: [{ title: "username", string_map_data: { "Saved on": { href, timestamp } } }] }
// and the newer one mirroring the HTML, a list of { label, value, href }
// pairs with the owner nested in `dict`. Each entry is searched for the
// pieces rather than walked by a fixed path.
function scanEntry(node, found) {
  if (Array.isArray(node)) {
    node.forEach((child) => scanEntry(child, found));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const key of ["href", "value"]) {
    if (!found.link && typeof node[key] === "string" && instagramPostRef(node[key])) found.link = node[key];
  }
  if (typeof node.label === "string" && typeof node.value === "string") {
    const label = node.label.trim();
    if (label === "Caption" && !found.caption) found.caption = node.value;
    if (label === "Name" && !found.ownerName) found.ownerName = node.value;
    if (label === "Username" && !found.ownerUsername) found.ownerUsername = node.value;
  }
  if (!found.timestamp && typeof node.timestamp === "number" && node.timestamp > 0) found.timestamp = node.timestamp;
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") scanEntry(value, found);
  }
}

function entriesOf(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That JSON file could not be read.");
  }
  return entriesOf(data).map((entry) => {
    const found = {};
    scanEntry(entry, found);
    return cleanItem({
      link: found.link,
      caption: fixMojibake(found.caption),
      ownerName: fixMojibake(found.ownerName),
      // The older shape names the account in the entry's title.
      ownerUsername: fixMojibake(found.ownerUsername || (typeof entry?.title === "string" ? entry.title : "")),
      savedAt: found.timestamp ? new Date(found.timestamp * 1000) : null,
    });
  });
}

/* ── entry point ───────────────────────────────────────── */

const SAVED_POSTS_FILE = /(^|\/)saved_posts\.(html?|json)$/i;

/** Whether a dropped file looks like something readExport() can take. */
export function isExportFile(file) {
  return /\.(zip|html?|json)$/i.test(file?.name || "");
}

/**
 * The saved posts in an export file, newest first as Instagram lists them,
 * with duplicates dropped: `[{ url, caption, ownerName, ownerUsername,
 * savedAt }]`. Throws with a message for the reader when the file is not
 * an export or holds no saved posts.
 */
export async function readExport(file) {
  const name = file?.name || "";
  let text;
  let kind;
  if (/\.zip$/i.test(name)) {
    const json = await readZipEntry(file, (entry) => /saved_posts\.json$/i.test(entry));
    text = json ?? (await readZipEntry(file, (entry) => /saved_posts\.html?$/i.test(entry)));
    kind = json != null ? "json" : "html";
    if (text == null) {
      throw new Error("No saved posts in that export. Request it with “Saved” selected.");
    }
  } else if (/\.html?$/i.test(name)) {
    text = await file.text();
    kind = "html";
  } else if (/\.json$/i.test(name)) {
    text = await file.text();
    kind = "json";
  } else {
    throw new Error("Drop the ZIP from Instagram, or saved_posts.html / saved_posts.json from inside it.");
  }

  const seen = new Set();
  const items = (kind === "json" ? parseJson(text) : parseHtml(text)).filter((item) => {
    if (!item || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  if (!items.length) {
    throw new Error(
      SAVED_POSTS_FILE.test(name)
        ? "No saved posts found in that file."
        : "No saved posts found. Use saved_posts.html or saved_posts.json from the export.",
    );
  }
  return items;
}
