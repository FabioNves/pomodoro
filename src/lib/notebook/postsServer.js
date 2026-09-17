// Server-side helpers for saved posts: the storage limits, the chunked file
// store (NotebookPostFile + NotebookPostChunk), signed media URLs and the
// byte-range streaming behind them. Server only: imports the models and
// signs with JWT_SECRET.

import crypto from "crypto";
import NotebookPost from "@/models/NotebookPost";
import NotebookPostFile from "@/models/NotebookPostFile";
import NotebookPostChunk from "@/models/NotebookPostChunk";
import { apiError } from "@/lib/notebook/server";
import { UPLOAD_CHUNK_SIZE, mediaKindOf } from "@/lib/notebook/posts";

const MB = 1024 * 1024;

function envMb(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value * MB : fallback * MB;
}

/** Per-file and per-user limits, in bytes. Env: NOTEBOOK_POST_MAX_MB, NOTEBOOK_POSTS_QUOTA_MB. */
export function storageLimits() {
  return {
    maxFile: envMb("NOTEBOOK_POST_MAX_MB", 100),
    quota: envMb("NOTEBOOK_POSTS_QUOTA_MB", 2048),
    chunkSize: UPLOAD_CHUNK_SIZE,
  };
}

/**
 * Bytes this user has stored or is in the middle of storing. Uploads in
 * flight count: they have already reserved their size, so starting twenty
 * at once cannot slip past the quota by each reading the same total.
 */
export async function storageUsed(userId) {
  const [row] = await NotebookPostFile.aggregate([
    { $match: { user: userId } },
    { $group: { _id: null, used: { $sum: "$size" } } },
  ]);
  return row?.used || 0;
}

/* ── signed URLs ───────────────────────────────────────── */

// A URL stays identical for a day so browsers can cache the media, and keeps
// working for another day, so a page opened just before the switch does not
// break. Short, because the link itself is the credential.
const SIGN_WINDOW_S = 24 * 3600;

function mediaSignature(userId, fileId, exp) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`notebook-media:${userId}:${fileId}:${exp}`)
    .digest("base64url");
}

/**
 * Relative URL that streams a file without a session header, which `<img>`
 * and `<video>` cannot send. The owner is part of what is signed, so a link
 * that leaks cannot be replayed against anyone else's file, and the route
 * re-checks ownership after loading it.
 */
export function mediaUrl(userId, fileId) {
  if (!fileId) return null;
  const id = String(fileId);
  const user = String(userId);
  const exp = (Math.floor(Date.now() / 1000 / SIGN_WINDOW_S) + 2) * SIGN_WINDOW_S;
  return `/api/notebook/posts/file?id=${id}&u=${encodeURIComponent(user)}&exp=${exp}&sig=${mediaSignature(user, id, exp)}`;
}

export function verifyMediaUrl(userId, fileId, exp, sig) {
  if (!process.env.JWT_SECRET) return false;
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;
  const expected = Buffer.from(mediaSignature(String(userId), String(fileId), expiry));
  const given = Buffer.from(String(sig || ""));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/* ── DTO ───────────────────────────────────────────────── */

export function postDto(post, files = new Map()) {
  const file = post.file ? files.get(String(post.file)) : null;
  const owner = String(post.user);
  return {
    id: String(post._id),
    title: post.title || "",
    note: post.note || "",
    platform: post.platform || "other",
    sourceUrl: post.sourceUrl || "",
    kind: post.kind,
    url: post.file ? mediaUrl(owner, post.file) : null,
    thumbUrl: post.thumb ? mediaUrl(owner, post.thumb) : null,
    mime: file?.mime || "",
    size: file?.size || 0,
    fileName: file?.name || "",
    width: post.width || 0,
    height: post.height || 0,
    duration: post.duration || 0,
    tags: post.tags || [],
    pinned: !!post.pinned,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/** The files a list of posts refers to, keyed by id. */
export async function filesOf(posts) {
  const ids = posts.map((p) => p.file).filter(Boolean);
  if (!ids.length) return new Map();
  const files = await NotebookPostFile.find({ _id: { $in: ids } }).select("mime size name");
  return new Map(files.map((f) => [String(f._id), f]));
}

/* ── files ─────────────────────────────────────────────── */

export async function deleteFiles(ids) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  // The file record goes first, so a chunk request still in flight fails to
  // find it; then the chunks, twice, in case one landed in between.
  await NotebookPostFile.deleteMany({ _id: { $in: list } });
  await NotebookPostChunk.deleteMany({ file: { $in: list } });
  await NotebookPostChunk.deleteMany({ file: { $in: list } });
}

/**
 * Removes this user's uploads that never became a post: unfinished ones and
 * finished ones nothing refers to, both older than a day. Called before a
 * new upload starts, so an abandoned drag-and-drop cannot eat the quota.
 */
export async function sweepOrphanFiles(userId) {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const stale = await NotebookPostFile.find({ user: userId, createdAt: { $lt: cutoff } }).select("_id complete");
  if (!stale.length) return;
  const referenced = new Set();
  const posts = await NotebookPost.find({ user: userId }).select("file thumb");
  for (const p of posts) {
    if (p.file) referenced.add(String(p.file));
    if (p.thumb) referenced.add(String(p.thumb));
  }
  await deleteFiles(stale.filter((f) => !referenced.has(String(f._id))).map((f) => f._id));
}

/** A finished upload of this user that no post uses yet, or throws. */
export async function claimFile(userId, fileId, { kinds = ["image", "video"] } = {}) {
  if (!fileId) return null;
  const file = await NotebookPostFile.findOne({ _id: fileId, user: userId });
  if (!file) throw apiError(400, "Upload not found");
  if (!file.complete) throw apiError(400, "The upload has not finished");
  const kind = mediaKindOf(file.mime);
  if (!kinds.includes(kind)) throw apiError(400, "That file type is not supported");
  const used = await NotebookPost.exists({ user: userId, $or: [{ file: file._id }, { thumb: file._id }] });
  if (used) throw apiError(400, "That upload already belongs to a post");
  return file;
}

/* ── streaming ─────────────────────────────────────────── */

/** Node Buffer from whatever the driver hands back for a Buffer field. */
export function chunkBytes(value) {
  if (!value) return Buffer.alloc(0);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value.buffer) return chunkBytes(value.buffer);
  if (typeof value.value === "function") return Buffer.from(value.value(true));
  return Buffer.from(value);
}

/**
 * Parses a Range header into an inclusive byte span, or null for the whole
 * file. Throws a 416 for a range the file cannot satisfy.
 */
export function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!match) return null;
  const [, startText, endText] = match;
  let start;
  let end;
  if (startText === "" && endText === "") return null;
  if (startText === "") {
    // "bytes=-500": the last 500 bytes.
    const suffix = Number(endText);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    throw apiError(416, "Range not satisfiable");
  }
  return { start, end };
}

/** A web stream of bytes [start, end] of a file, read chunk by chunk. */
export function fileStream(file, { start, end }) {
  const { chunkSize } = file;
  const last = Math.floor(end / chunkSize);
  let n = Math.floor(start / chunkSize);
  return new ReadableStream({
    async pull(controller) {
      if (n > last) {
        controller.close();
        return;
      }
      const chunk = await NotebookPostChunk.findOne({ file: file._id, n }).select("data").lean();
      if (!chunk) {
        controller.error(new Error(`chunk ${n} of file ${file._id} is missing`));
        return;
      }
      const bytes = chunkBytes(chunk.data);
      const offset = n * chunkSize;
      const from = Math.max(0, start - offset);
      const to = Math.min(bytes.length, end - offset + 1);
      controller.enqueue(new Uint8Array(bytes.buffer, bytes.byteOffset + from, Math.max(0, to - from)));
      n += 1;
    },
  });
}
