import { connectToDB } from "@/lib/db";
import WeekPlan from "@/models/WeekPlan";
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
  id: objectIdSchema.optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  projects: z.array(objectIdSchema).optional(),
  estimatedDailyTime: z.number().min(0).max(1440).optional(),
});

const patchSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(200).optional(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  projects: z.array(objectIdSchema).optional(),
  estimatedDailyTime: z.number().min(0).max(1440).optional(),
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

    const identQuery = identityQuery(ident.data);

    if (qv.data.id) {
      const plan = await WeekPlan.findOne({
        _id: qv.data.id,
        ...identQuery,
      });
      if (!plan) return jsonError(404, "Week plan not found");
      return Response.json(plan);
    }

    const plans = await WeekPlan.find(identQuery).sort({ weekStart: -1 });
    return Response.json(plans);
  } catch (error) {
    console.error("Error fetching week plans:", error);
    return jsonError(500, "Error fetching week plans");
  }
}

export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identity = getIdentityHeaders(req);

    await connectToDB();

    const plan = await WeekPlan.create({
      name: body.data.name,
      weekStart: body.data.weekStart,
      projects: body.data.projects || [],
      estimatedDailyTime: body.data.estimatedDailyTime || 60,
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(plan, { status: 201 });
  } catch (error) {
    console.error("Error creating week plan:", error);
    return jsonError(500, "Error creating week plan");
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

    const plan = await WeekPlan.findOneAndUpdate(
      { _id: id, ...identityQuery(ident.data) },
      { $set: updates },
      { new: true },
    );

    if (!plan) return jsonError(404, "Week plan not found");

    return Response.json(plan);
  } catch (error) {
    console.error("Error updating week plan:", error);
    return jsonError(500, "Error updating week plan");
  }
}

export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const deleted = await WeekPlan.findOneAndDelete({
      _id: body.data.id,
      ...identityQuery(ident.data),
    });

    if (!deleted) return jsonError(404, "Week plan not found");

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting week plan:", error);
    return jsonError(500, "Error deleting week plan");
  }
}
