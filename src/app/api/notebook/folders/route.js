import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookFolder from "@/models/NotebookFolder";
import NotebookDocument from "@/models/NotebookDocument";
import NotebookSettings from "@/models/NotebookSettings";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import {
  SIGN_IN,
  LIMITS,
  objectId,
  run,
  apiError,
  folderDto,
  assertFolder,
  folderSubtree,
} from "@/lib/notebook/server";

const folderName = z.string().trim().min(1).max(LIMITS.folderName);

// POST /api/notebook/folders  { name, parent? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({ name: folderName, parent: objectId.nullable().optional() }),
  );
  if (!body.ok) return body.response;

  return run("POST folders", async () => {
    await connectToDB();
    const parent = await assertFolder(auth.userId, body.data.parent);
    const parentId = parent ? parent._id : null;
    const last = await NotebookFolder.find({ user: auth.userId, parent: parentId })
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });
    const folder = await NotebookFolder.create({
      user: auth.userId,
      name: body.data.name,
      parent: parentId,
      order: (last[0]?.order ?? -1) + 1,
    });
    return Response.json({ folder: folderDto(folder) }, { status: 201 });
  });
}

// PATCH /api/notebook/folders  { id, name?, parent?, order? }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      name: folderName.optional(),
      parent: objectId.nullable().optional(),
      order: z.number().int().min(0).max(100000).optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH folders", async () => {
    await connectToDB();
    const { id, name, parent, order } = body.data;
    const folder = await NotebookFolder.findOne({ _id: id, user: auth.userId });
    if (!folder) throw apiError(404, "Folder not found");

    if (name !== undefined) folder.name = name;
    if (parent !== undefined) {
      if (parent) {
        if (parent === id) throw apiError(400, "A folder cannot be moved into itself");
        const subtree = await folderSubtree(auth.userId, id);
        if (subtree.has(parent)) {
          throw apiError(400, "A folder cannot be moved into one of its own subfolders");
        }
        await assertFolder(auth.userId, parent);
      }
      folder.parent = parent || null;
    }
    if (order !== undefined) folder.order = order;
    await folder.save();
    return Response.json({ folder: folderDto(folder) });
  });
}

// DELETE /api/notebook/folders  { id }
// Deletes the folder and its subfolders. Notes inside are not deleted: they
// move to the deleted folder's parent (or the top level).
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE folders", async () => {
    await connectToDB();
    const folder = await NotebookFolder.findOne({ _id: body.data.id, user: auth.userId });
    if (!folder) throw apiError(404, "Folder not found");

    const ids = [...(await folderSubtree(auth.userId, folder._id))];
    const target = folder.parent || null;
    await NotebookDocument.updateMany(
      { user: auth.userId, folder: { $in: ids } },
      { $set: { folder: target } },
    );
    await NotebookSettings.updateMany(
      { user: auth.userId },
      { $set: { "views.$[view].folder": target } },
      { arrayFilters: [{ "view.folder": { $in: ids } }] },
    );
    await NotebookFolder.deleteMany({ user: auth.userId, _id: { $in: ids } });
    return Response.json({
      ok: true,
      deletedIds: ids,
      movedTo: target ? String(target) : null,
    });
  });
}
