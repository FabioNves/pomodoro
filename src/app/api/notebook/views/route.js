import { z } from "zod";
import { connectToDB } from "@/lib/db";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { MAX_VIEWS } from "@/lib/notebook/subjects";
import {
  SIGN_IN,
  objectId,
  subjectName,
  run,
  apiError,
  ensureSettings,
  settingsDto,
  assertFolder,
} from "@/lib/notebook/server";

// A saved view: a named, filtered list of notes shown in the sidebar.
const viewFields = {
  name: z.string().trim().min(1).max(60),
  layout: z.enum(["list", "grid"]),
  folder: objectId.nullable(),
  subjects: z.array(subjectName).max(20),
  sort: z.enum(["updated", "created", "title"]),
};

// POST /api/notebook/views  { name, layout?, folder?, subjects?, sort? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      name: viewFields.name,
      layout: viewFields.layout.optional(),
      folder: viewFields.folder.optional(),
      subjects: viewFields.subjects.optional(),
      sort: viewFields.sort.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST views", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    if (settings.views.length >= MAX_VIEWS) {
      throw apiError(400, `You can have at most ${MAX_VIEWS} saved views`);
    }
    await assertFolder(auth.userId, body.data.folder);
    settings.views.push({
      name: body.data.name,
      layout: body.data.layout || "list",
      folder: body.data.folder || null,
      subjects: body.data.subjects || [],
      sort: body.data.sort || "updated",
    });
    await settings.save();
    const view = settings.views[settings.views.length - 1];
    return Response.json(
      { settings: settingsDto(settings), viewId: String(view._id) },
      { status: 201 },
    );
  });
}

// PATCH /api/notebook/views  { id, name?, layout?, folder?, subjects?, sort? }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      name: viewFields.name.optional(),
      layout: viewFields.layout.optional(),
      folder: viewFields.folder.optional(),
      subjects: viewFields.subjects.optional(),
      sort: viewFields.sort.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH views", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const view = settings.views.id(body.data.id);
    if (!view) throw apiError(404, "View not found");
    const { name, layout, folder, subjects, sort } = body.data;
    if (name !== undefined) view.name = name;
    if (layout !== undefined) view.layout = layout;
    if (folder !== undefined) {
      await assertFolder(auth.userId, folder);
      view.folder = folder || null;
    }
    if (subjects !== undefined) view.subjects = subjects;
    if (sort !== undefined) view.sort = sort;
    await settings.save();
    return Response.json({ settings: settingsDto(settings) });
  });
}

// DELETE /api/notebook/views  { id }
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE views", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    if (!settings.views.id(body.data.id)) throw apiError(404, "View not found");
    settings.views.pull(body.data.id);
    await settings.save();
    return Response.json({ settings: settingsDto(settings) });
  });
}
