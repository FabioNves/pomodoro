// Uploading a saved post from the browser: the file is sent to
// /api/notebook/posts/upload in pieces, then the post is created with the
// resulting file id. Browser only (it reads Blobs and makes thumbnails).

import { notebookApi } from "@/lib/notebook/client";
import { describeMedia } from "@/lib/notebook/media";
import { mediaKindOf, mediaTypeOf, titleFromFileName } from "@/lib/notebook/posts";

/** Sends one file in chunks and returns its id. `onProgress(0..1)`. */
export async function uploadFile(file, { name, mime, onProgress, signal } = {}) {
  const start = await notebookApi("/api/notebook/posts/upload", {
    method: "POST",
    body: { name: (name || file.name || "").slice(0, 255), mime: mime || file.type, size: file.size },
    signal,
  });
  const { fileId, chunkSize, chunkCount } = start;
  try {
    for (let n = 0; n < chunkCount; n += 1) {
      const slice = file.slice(n * chunkSize, Math.min(file.size, (n + 1) * chunkSize));
      await notebookApi(`/api/notebook/posts/upload?id=${fileId}&n=${n}`, {
        method: "PUT",
        blob: await slice.arrayBuffer(),
        signal,
      });
      onProgress?.((n + 1) / chunkCount);
    }
  } catch (error) {
    // Leave nothing half-written behind; a failed sweep is not the user's problem.
    notebookApi("/api/notebook/posts/upload", { method: "DELETE", body: { id: fileId } }).catch(() => {});
    throw error;
  }
  return fileId;
}

/**
 * Full "dropped a file" flow: work out the thumbnail, upload both files and
 * create the post.
 *
 * @param {File} file
 * @param {{ fields?: object, onProgress?: (n:number)=>void, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ post: object, storage: object }>}
 */
export async function uploadPost(file, { fields = {}, onProgress, signal } = {}) {
  const mime = mediaTypeOf(file);
  const kind = mediaKindOf(mime);
  if (!kind) {
    throw new Error(`${file.name || "That file"} is not an image or a video.`);
  }

  const media = await describeMedia(file, kind);
  // The thumbnail is tiny next to the media, so it gets the last slice of
  // the progress bar rather than a share of it.
  const fileId = await uploadFile(file, { mime, onProgress: (p) => onProgress?.(p * (media.blob ? 0.95 : 1)), signal });

  let thumbId = null;
  if (media.blob) {
    try {
      thumbId = await uploadFile(media.blob, {
        name: `thumb-${file.name || "post"}.jpg`,
        mime: "image/jpeg",
        signal,
      });
    } catch (error) {
      console.warn("[posts] thumbnail upload failed:", error?.message || error);
    }
  }
  onProgress?.(1);

  try {
    return await createPost({ fileId, thumbId, file, media, fields, signal });
  } catch (error) {
    // The bytes are already stored and would sit against the quota until the
    // daily sweep; drop them now, since no post will ever point at them.
    await discard(fileId);
    await discard(thumbId);
    throw error;
  }
}

/** Drops an upload nothing refers to. Never throws: cleanup is best effort. */
async function discard(fileId) {
  if (!fileId) return;
  try {
    await notebookApi("/api/notebook/posts/upload", { method: "DELETE", body: { id: fileId } });
  } catch {
    /* the daily sweep will get it */
  }
}

async function createPost({ fileId, thumbId, file, media, fields, signal }) {
  const data = await notebookApi("/api/notebook/posts", {
    method: "POST",
    body: {
      fileId,
      thumbId,
      title: fields.title ?? titleFromFileName(file.name),
      note: fields.note || "",
      sourceUrl: fields.sourceUrl || "",
      ...(fields.platform ? { platform: fields.platform } : {}),
      width: media.width,
      height: media.height,
      duration: Math.round(media.duration || 0),
      tags: fields.tags || [],
    },
    signal,
  });
  return data;
}
