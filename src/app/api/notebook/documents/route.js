import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookDocument from "@/models/NotebookDocument";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody, validateSearchParams } from "@/utils/apiValidation";
import {
  SIGN_IN,
  LIMITS,
  objectId,
  subjectList,
  run,
  apiError,
  docDto,
  docSummaryDto,
  assertFolder,
  deriveDocument,
} from "@/lib/notebook/server";

const docTitle = z.string().trim().min(1).max(LIMITS.title);

// GET /api/notebook/documents?id=  — one note with all its tabs.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, z.object({ id: objectId }));
  if (!query.ok) return query.response;

  return run("GET documents", async () => {
    await connectToDB();
    const doc = await NotebookDocument.findOneAndUpdate(
      { _id: query.data.id, user: auth.userId },
      { $set: { lastOpenedAt: new Date() } },
      { new: true, timestamps: false },
    );
    if (!doc) throw apiError(404, "Note not found");
    return Response.json({ document: docDto(doc) });
  });
}

// POST /api/notebook/documents  { title?, folder?, subjects? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      title: docTitle.optional(),
      folder: objectId.nullable().optional(),
      subjects: subjectList.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST documents", async () => {
    await connectToDB();
    const folder = await assertFolder(auth.userId, body.data.folder);
    const doc = new NotebookDocument({
      user: auth.userId,
      title: body.data.title || "Untitled",
      folder: folder ? folder._id : null,
      subjects: body.data.subjects || [],
      tabs: [{ title: "Tab 1", content: "", parent: null, order: 0 }],
    });
    deriveDocument(doc);
    await doc.save();
    return Response.json({ document: docDto(doc) }, { status: 201 });
  });
}

// PATCH /api/notebook/documents  { id, title?, folder?, subjects?, pinned?, order? }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      title: docTitle.optional(),
      folder: objectId.nullable().optional(),
      subjects: subjectList.optional(),
      pinned: z.boolean().optional(),
      order: z.number().int().min(0).max(100000).optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH documents", async () => {
    await connectToDB();
    const { id, title, folder, subjects, pinned, order } = body.data;
    const doc = await NotebookDocument.findOne({ _id: id, user: auth.userId });
    if (!doc) throw apiError(404, "Note not found");

    if (title !== undefined) doc.title = title;
    if (folder !== undefined) {
      await assertFolder(auth.userId, folder);
      doc.folder = folder || null;
    }
    if (subjects !== undefined) doc.subjects = subjects;
    if (pinned !== undefined) doc.pinned = pinned;
    if (order !== undefined) doc.order = order;

    // Only edits to what the note says count as "last edited".
    const edited = title !== undefined || subjects !== undefined;
    await doc.save(edited ? undefined : { timestamps: false });
    return Response.json({ document: docSummaryDto(doc) });
  });
}

// DELETE /api/notebook/documents  { id }
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE documents", async () => {
    await connectToDB();
    const deleted = await NotebookDocument.findOneAndDelete({
      _id: body.data.id,
      user: auth.userId,
    });
    if (!deleted) throw apiError(404, "Note not found");
    return Response.json({ ok: true, id: String(deleted._id) });
  });
}
