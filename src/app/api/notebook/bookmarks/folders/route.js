import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookBookmark from "@/models/NotebookBookmark";
import NotebookBookmarkFolder from "@/models/NotebookBookmarkFolder";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { SIGN_IN, objectId, run, apiError, bookmarkFolderDto } from "@/lib/notebook/server";
import { BOOKMARK_LIMITS } from "@/lib/notebook/bookmarks";

const name = z.string().trim().min(1).max(BOOKMARK_LIMITS.folderName);

// POST /api/notebook/bookmarks/folders  { name }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ name }));
  if (!body.ok) return body.response;

  return run("POST bookmark folder", async () => {
    await connectToDB();
    const folder = await NotebookBookmarkFolder.create({ user: auth.userId, name: body.data.name });
    return Response.json({ folder: bookmarkFolderDto(folder) }, { status: 201 });
  });
}

// PATCH /api/notebook/bookmarks/folders  { id, name }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId, name }));
  if (!body.ok) return body.response;

  return run("PATCH bookmark folder", async () => {
    await connectToDB();
    const folder = await NotebookBookmarkFolder.findOneAndUpdate(
      { _id: body.data.id, user: auth.userId },
      { $set: { name: body.data.name } },
      { new: true },
    );
    if (!folder) throw apiError(404, "Folder not found");
    return Response.json({ folder: bookmarkFolderDto(folder) });
  });
}

// DELETE /api/notebook/bookmarks/folders  { id, bookmarks: "delete" | "keep" }
// "delete" deletes the folder's bookmarks for good (a later import of that
// account brings them back); "keep" leaves them in no folder.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId, bookmarks: z.enum(["delete", "keep"]) }));
  if (!body.ok) return body.response;

  return run("DELETE bookmark folder", async () => {
    await connectToDB();
    const folder = await NotebookBookmarkFolder.findOneAndDelete({ _id: body.data.id, user: auth.userId });
    if (!folder) throw apiError(404, "Folder not found");
    const filter = { user: auth.userId, folder: folder._id };
    if (body.data.bookmarks === "delete") {
      const { deletedCount } = await NotebookBookmark.deleteMany(filter);
      return Response.json({ ok: true, deleted: deletedCount || 0 });
    }
    await NotebookBookmark.updateMany(filter, { $set: { folder: null } });
    return Response.json({ ok: true, deleted: 0 });
  });
}
