// Browser-side media helpers for saved posts: thumbnails and dimensions are
// worked out on the device before the upload starts, so the grid only ever
// loads small JPEGs and the server never decodes a file. Browser only (uses
// canvas and object URLs); never imported by the API routes.

const THUMB_MAX = 640;
const THUMB_QUALITY = 0.82;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the thumbnail"))), "image/jpeg", THUMB_QUALITY);
  });
}

function drawScaled(source, width, height) {
  const size = fitWithin(width, height, THUMB_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image"));
    img.src = url;
  });
}

/**
 * A JPEG thumbnail of an image file plus its pixel size.
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function imageThumbnail(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await withTimeout(loadImage(url), 15000, "Reading the image");
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = drawScaled(img, width, height);
    return { blob: await canvasToJpeg(canvas), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function once(target, event, { reject: rejectEvent = "error" } = {}) {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("Could not decode the video"));
    };
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener(rejectEvent, fail);
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener(rejectEvent, fail, { once: true });
  });
}

/**
 * A JPEG poster frame of a video file (about a second in), its pixel size
 * and its length in seconds.
 * @returns {Promise<{ blob: Blob, width: number, height: number, duration: number }>}
 */
export async function videoThumbnail(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await withTimeout(once(video, "loadedmetadata"), 15000, "Reading the video");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("Could not decode the video");
    // A zero-length seek often fires no "seeked" event at all, so only wait
    // when there is really somewhere to seek to.
    const at = Math.min(1, Math.max(0, duration / 2));
    if (at > 0) {
      const seeked = once(video, "seeked");
      video.currentTime = at;
      await withTimeout(seeked, 15000, "Reading the video");
    }
    const canvas = drawScaled(video, width, height);
    return { blob: await canvasToJpeg(canvas), width, height, duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Thumbnail and dimensions for an image or video file. Never throws: a file
 * the browser cannot decode simply gets no thumbnail.
 * @returns {Promise<{ blob: Blob|null, width: number, height: number, duration: number }>}
 */
export async function describeMedia(file, kind) {
  try {
    if (kind === "image") return { duration: 0, ...(await imageThumbnail(file)) };
    if (kind === "video") return await videoThumbnail(file);
  } catch (error) {
    console.warn("[posts] no thumbnail:", error?.message || error);
  }
  return { blob: null, width: 0, height: 0, duration: 0 };
}

/** Files from a drop or paste event: dropped files, or images copied from elsewhere. */
export function filesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return [];
  const files = [];
  if (dataTransfer.items?.length) {
    for (const item of dataTransfer.items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (!files.length && dataTransfer.files?.length) files.push(...dataTransfer.files);
  return files;
}

/** The URL in a drop or paste, when a link (not a file) was dragged in. */
export function urlFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return "";
  const text = dataTransfer.getData("text/uri-list") || dataTransfer.getData("text/plain") || "";
  const first = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  return first && /^https?:\/\//i.test(first) ? first : "";
}
