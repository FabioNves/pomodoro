import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookDocument from "@/models/NotebookDocument";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import {
  SUGGESTED_SUBJECTS,
  MAX_SUBJECTS,
  SUBJECT_COLOR_RE,
  subjectKey,
  colorForSubject,
} from "@/lib/notebook/subjects";
import {
  SIGN_IN,
  subjectName,
  run,
  apiError,
  ensureSettings,
  settingsDto,
} from "@/lib/notebook/server";

const color = z.string().regex(SUBJECT_COLOR_RE, "Use a #rrggbb colour");

// POST /api/notebook/subjects  { name, color? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ name: subjectName, color: color.optional() }));
  if (!body.ok) return body.response;

  return run("POST subjects", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const key = subjectKey(body.data.name);
    if (settings.subjects.some((s) => s.key === key)) {
      return Response.json({ settings: settingsDto(settings), created: false });
    }
    if (settings.subjects.length >= MAX_SUBJECTS) {
      throw apiError(400, `You can have at most ${MAX_SUBJECTS} subjects`);
    }
    settings.subjects.push({
      name: body.data.name,
      key,
      color: body.data.color || colorForSubject(body.data.name, settings.subjects.map((s) => s.color)),
      source: SUGGESTED_SUBJECTS.some((s) => subjectKey(s) === key) ? "suggested" : "custom",
    });
    await settings.save();
    return Response.json({ settings: settingsDto(settings), created: true }, { status: 201 });
  });
}

// PATCH /api/notebook/subjects  { name, newName?, color? }
// Renaming also renames the subject on every note and saved view that uses it.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({ name: subjectName, newName: subjectName.optional(), color: color.optional() }),
  );
  if (!body.ok) return body.response;

  return run("PATCH subjects", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const subject = settings.subjects.find((s) => s.key === subjectKey(body.data.name));
    if (!subject) throw apiError(404, "Subject not found");

    if (body.data.newName !== undefined) {
      const newKey = subjectKey(body.data.newName);
      if (newKey !== subject.key && settings.subjects.some((s) => s.key === newKey)) {
        throw apiError(400, "That subject already exists");
      }
      const previous = subject.name;
      subject.name = body.data.newName;
      subject.key = newKey;
      for (const view of settings.views) {
        view.subjects = view.subjects.map((s) => (s === previous ? body.data.newName : s));
      }
      await NotebookDocument.updateMany(
        { user: auth.userId, subjects: previous },
        { $set: { "subjects.$": body.data.newName } },
      );
    }
    if (body.data.color) subject.color = body.data.color;
    await settings.save();
    return Response.json({ settings: settingsDto(settings) });
  });
}

// DELETE /api/notebook/subjects  { name }  — also removes it from every note and view.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ name: subjectName }));
  if (!body.ok) return body.response;

  return run("DELETE subjects", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const key = subjectKey(body.data.name);
    const subject = settings.subjects.find((s) => s.key === key);
    if (!subject) throw apiError(404, "Subject not found");
    const name = subject.name;
    settings.subjects = settings.subjects.filter((s) => s.key !== key);
    for (const view of settings.views) {
      view.subjects = view.subjects.filter((s) => s !== name);
    }
    await settings.save();
    await NotebookDocument.updateMany(
      { user: auth.userId, subjects: name },
      { $pull: { subjects: name } },
    );
    return Response.json({ settings: settingsDto(settings) });
  });
}
