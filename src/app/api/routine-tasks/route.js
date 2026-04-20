import { connectToDB } from "@/lib/db";
import RoutineTask from "@/models/RoutineTask";
import { z } from "zod";
import {
  validateIdentityHeaders,
  getIdentityHeaders,
  validateJsonBody,
  validateSearchParams,
  jsonError,
} from "@/utils/apiValidation";

function identityQuery({ userId, sessionId }) {
  if (userId) return { user: userId };
  if (sessionId) return { sessionId };
  return null;
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const querySchema = z.object({
  projectId: objectIdSchema,
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: objectIdSchema,
  frequency: z
    .enum([
      "daily",
      "weekly",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
      "custom",
    ])
    .optional(),
  frequencyCustom: z.string().max(200).optional(),
  estimatedTime: z.number().min(0).max(9999).optional(),
  notes: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
  customFields: z
    .array(
      z.object({
        column: objectIdSchema,
        value: z.any(),
      }),
    )
    .optional(),
});

const patchSchema = z.object({
  id: objectIdSchema,
  title: z.string().trim().min(1).max(200).optional(),
  frequency: z
    .enum([
      "daily",
      "weekly",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
      "custom",
    ])
    .optional(),
  frequencyCustom: z.string().max(200).optional(),
  estimatedTime: z.number().min(0).max(9999).optional(),
  notes: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
  customFields: z
    .array(
      z.object({
        column: objectIdSchema,
        value: z.any(),
      }),
    )
    .optional(),
});

const deleteSchema = z.object({
  id: objectIdSchema,
});

export async function GET(req) {
  try {
    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const qv = validateSearchParams(req, querySchema);
    if (!qv.ok) return qv.response;

    await connectToDB();

    const tasks = await RoutineTask.find({
      ...identityQuery(ident.data),
      project: qv.data.projectId,
    }).sort({ order: 1, createdAt: 1 });

    return Response.json(tasks);
  } catch (error) {
    console.error("Error fetching routine tasks:", error);
    return jsonError(500, "Error fetching routine tasks");
  }
}

export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identity = getIdentityHeaders(req);
    const identQuery = identityQuery(ident.data);

    await connectToDB();

    const maxDoc = await RoutineTask.find({
      ...identQuery,
      project: body.data.projectId,
    })
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });

    const nextOrder = (maxDoc?.[0]?.order ?? -1) + 1 || 0;

    const task = await RoutineTask.create({
      title: body.data.title,
      project: body.data.projectId,
      frequency: body.data.frequency || "daily",
      frequencyCustom: body.data.frequencyCustom || "",
      estimatedTime: body.data.estimatedTime || 0,
      notes: body.data.notes || "",
      customFields: body.data.customFields || [],
      order: nextOrder,
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating routine task:", error);
    return jsonError(500, "Error creating routine task");
  }
}

export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const { id, ...updates } = body.data;

    await connectToDB();

    const task = await RoutineTask.findOneAndUpdate(
      { _id: id, ...identityQuery(ident.data) },
      { $set: updates },
      { new: true },
    );

    if (!task) return jsonError(404, "Routine task not found");

    return Response.json(task);
  } catch (error) {
    console.error("Error updating routine task:", error);
    return jsonError(500, "Error updating routine task");
  }
}

export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const deleted = await RoutineTask.findOneAndDelete({
      _id: body.data.id,
      ...identityQuery(ident.data),
    });

    if (!deleted) return jsonError(404, "Routine task not found");

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting routine task:", error);
    return jsonError(500, "Error deleting routine task");
  }
}
