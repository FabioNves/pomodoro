import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookBookmark from "@/models/NotebookBookmark";
import NotebookBookmarkFolder from "@/models/NotebookBookmarkFolder";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { SIGN_IN, objectId, run, apiError, bookmarkFolderDto } from "@/lib/notebook/server";
import { BOOKMARK_LIMITS, instagramPostRef } from "@/lib/notebook/bookmarks";

// Longer text is cut rather than refused, so one long caption cannot fail
// a whole import.
const clipped = (max) => z.string().max(max * 4).default("").transform((v) => v.trim().slice(0, max));
const idList = z.array(objectId).min(1).max(BOOKMARK_LIMITS.ids);

/** Throws a 404 unless `folderId` is null or one of this user's folders. */
async function checkFolder(userId, folderId) {
  if (folderId && !(await NotebookBookmarkFolder.exists({ _id: folderId, user: userId }))) {
    throw apiError(404, "Folder not found");
  }
}

function bookmarkDto(b) {
  return {
    id: String(b._id),
    code: b.code,
    kind: b.kind,
    url: b.url,
    caption: b.caption || "",
    ownerName: b.ownerName || "",
    ownerUsername: b.ownerUsername || "",
    savedAt: b.savedAt || null,
    importedAt: b.importedAt || null,
    folder: b.folder ? String(b.folder) : null,
  };
}

// GET /api/notebook/bookmarks — every bookmark, most recently saved first,
// the folders, and when the last import was.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  return run("GET bookmarks", async () => {
    await connectToDB();
    const [bookmarks, folders, last] = await Promise.all([
      NotebookBookmark.find({ user: auth.userId, dismissed: false }).sort({ savedAt: -1, _id: 1 }).lean(),
      NotebookBookmarkFolder.find({ user: auth.userId }).collation({ locale: "en" }).sort({ name: 1 }).lean(),
      NotebookBookmark.findOne({ user: auth.userId }).sort({ importedAt: -1 }).select("importedAt").lean(),
    ]);
    return Response.json({
      bookmarks: bookmarks.map(bookmarkDto),
      folders: folders.map(bookmarkFolderDto),
      lastImportAt: last?.importedAt || null,
    });
  });
}

// POST /api/notebook/bookmarks
// { folder?, items: [{ url, caption?, ownerName?, ownerUsername?, savedAt? }] }
// One batch of an import (the browser reads the export and sends the posts
// in batches of BOOKMARK_LIMITS.batch). Adds new posts and refreshes the
// ones already there; a dismissed one stays dismissed. With a folder, the
// posts that are in no folder yet go into it; posts already filed in
// another folder stay where they are.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      folder: objectId.nullable().optional(),
      items: z
        .array(
          z.object({
            url: z.string().max(1000),
            caption: clipped(BOOKMARK_LIMITS.caption),
            ownerName: clipped(BOOKMARK_LIMITS.ownerName),
            ownerUsername: clipped(BOOKMARK_LIMITS.ownerUsername),
            savedAt: z.string().datetime().nullable().optional(),
          }),
        )
        .min(1)
        .max(BOOKMARK_LIMITS.batch),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST bookmarks", async () => {
    const now = new Date();
    const byCode = new Map();
    for (const item of body.data.items) {
      const ref = instagramPostRef(item.url);
      if (ref && !byCode.has(ref.code)) byCode.set(ref.code, { ...item, ...ref });
    }
    if (!byCode.size) throw apiError(400, "No Instagram posts in that import");

    await connectToDB();
    const folder = body.data.folder || null;
    await checkFolder(auth.userId, folder);
    const result = await NotebookBookmark.bulkWrite(
      [...byCode.values()].map((item) => {
        // Only what the export actually says replaces what is stored.
        const set = { importedAt: now };
        if (item.caption) set.caption = item.caption;
        if (item.ownerName) set.ownerName = item.ownerName;
        if (item.ownerUsername) set.ownerUsername = item.ownerUsername;
        if (item.savedAt) set.savedAt = new Date(item.savedAt);
        return {
          updateOne: {
            filter: { user: auth.userId, code: item.code },
            update: {
              $set: set,
              $setOnInsert: { user: auth.userId, code: item.code, kind: item.kind, url: item.url, dismissed: false },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
    if (folder) {
      await NotebookBookmark.updateMany(
        { user: auth.userId, code: { $in: [...byCode.keys()] }, folder: null },
        { $set: { folder } },
      );
    }
    return Response.json({ added: result.upsertedCount || 0, updated: result.matchedCount || 0 });
  });
}

// PATCH /api/notebook/bookmarks  { ids, folder }  — moves bookmarks into a
// folder, or out of every folder with `folder: null`.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ ids: idList, folder: objectId.nullable() }));
  if (!body.ok) return body.response;

  return run("PATCH bookmarks", async () => {
    await connectToDB();
    await checkFolder(auth.userId, body.data.folder);
    const { modifiedCount } = await NotebookBookmark.updateMany(
      { user: auth.userId, _id: { $in: body.data.ids } },
      { $set: { folder: body.data.folder } },
    );
    return Response.json({ ok: true, moved: modifiedCount || 0 });
  });
}

// DELETE /api/notebook/bookmarks  { ids } removes bookmarks (kept as
// dismissed, so a later import does not bring them back); { all: true }
// deletes every bookmark and folder, dismissed ones included, for a fresh
// start.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.union([z.object({ ids: idList }), z.object({ all: z.literal(true) })]),
  );
  if (!body.ok) return body.response;

  return run("DELETE bookmarks", async () => {
    await connectToDB();
    if (body.data.all) {
      const [{ deletedCount }] = await Promise.all([
        NotebookBookmark.deleteMany({ user: auth.userId }),
        NotebookBookmarkFolder.deleteMany({ user: auth.userId }),
      ]);
      return Response.json({ ok: true, deleted: deletedCount || 0 });
    }
    const { modifiedCount } = await NotebookBookmark.updateMany(
      { user: auth.userId, _id: { $in: body.data.ids } },
      { $set: { dismissed: true } },
    );
    return Response.json({ ok: true, removed: modifiedCount || 0 });
  });
}
