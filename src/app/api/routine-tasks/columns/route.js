import { connectToDB } from "@/lib/db";
import RoutineTaskColumn from "@/models/RoutineTaskColumn";
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

const colorRuleSchema = z.object({
  value: z.string().max(200),
  color: z.string().max(20),
});

const createSchema = z.object({
  projectId: objectIdSchema,
  name: z.string().trim().min(1).max(100),
  type: z.enum(["text", "dropdown", "number", "date"]),
  options: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  colorRules: z.array(colorRuleSchema).max(50).optional(),
});

const patchSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(["text", "dropdown", "number", "date"]).optional(),
  options: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  colorRules: z.array(colorRuleSchema).max(50).optional(),
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

    const columns = await RoutineTaskColumn.find({
      ...identityQuery(ident.data),
      project: qv.data.projectId,
    }).sort({ order: 1, createdAt: 1 });

    return Response.json(columns);
  } catch (error) {
    console.error("Error fetching columns:", error);
    return jsonError(500, "Error fetching columns");
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

    const maxDoc = await RoutineTaskColumn.find({
      ...identQuery,
      project: body.data.projectId,
    })
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });

    const nextOrder = (maxDoc?.[0]?.order ?? -1) + 1 || 0;

    const column = await RoutineTaskColumn.create({
      project: body.data.projectId,
      name: body.data.name,
      type: body.data.type,
      options: body.data.options || [],
      colorRules: body.data.colorRules || [],
      order: nextOrder,
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(column, { status: 201 });
  } catch (error) {
    console.error("Error creating column:", error);
    return jsonError(500, "Error creating column");
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

    const column = await RoutineTaskColumn.findOneAndUpdate(
      { _id: id, ...identityQuery(ident.data) },
      { $set: updates },
      { new: true },
    );

    if (!column) return jsonError(404, "Column not found");

    return Response.json(column);
  } catch (error) {
    console.error("Error updating column:", error);
    return jsonError(500, "Error updating column");
  }
}

export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);

    await connectToDB();

    const deleted = await RoutineTaskColumn.findOneAndDelete({
      _id: body.data.id,
      ...identQuery,
    });

    if (!deleted) return jsonError(404, "Column not found");

    // Remove references from routine tasks
    await RoutineTask.updateMany(
      { ...identQuery },
      { $pull: { customFields: { column: body.data.id } } },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting column:", error);
    return jsonError(500, "Error deleting column");
  }
}
