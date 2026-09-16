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
import {
  DAY_KEYS,
  MAX_MONTHLY_RULES,
  YMD_RE,
  isValidMonthlyRule,
} from "@/lib/routineSchedule";

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

const frequencyValue = z.enum([
  "daily",
  "weekly",
  ...DAY_KEYS,
  "custom",
  "monthly",
]);

// One monthly pattern: first Monday (weekday), first week (week) or the
// 15th / last day (day). See src/lib/routineSchedule.js.
const monthlyRule = z
  .object({
    type: z.enum(["weekday", "week", "day"]),
    nth: z.number().int().min(-1).max(4).optional(),
    weekday: z.enum(DAY_KEYS).optional().nullable(),
    day: z.number().int().min(-1).max(31).optional(),
  })
  .refine(isValidMonthlyRule, { message: "Invalid monthly rule" })
  .transform((rule) => {
    if (rule.type === "day") return { type: "day", day: rule.day };
    if (rule.type === "weekday") return { type: "weekday", nth: rule.nth, weekday: rule.weekday };
    return { type: "week", nth: rule.nth, ...(rule.weekday ? { weekday: rule.weekday } : {}) };
  });

// "" clears a date; null is accepted for the same purpose.
const ymd = z
  .union([z.literal(""), z.string().regex(YMD_RE, "Use YYYY-MM-DD")])
  .nullable()
  .transform((v) => v || "");

const customFields = z
  .array(
    z.object({
      column: objectIdSchema,
      value: z.any(),
    }),
  )
  .optional();

const editableFields = {
  title: z.string().trim().min(1).max(200).optional(),
  frequency: frequencyValue.optional(),
  frequencies: z.array(frequencyValue).max(12).optional(),
  monthly: z.array(monthlyRule).max(MAX_MONTHLY_RULES).optional(),
  autoSchedule: z.boolean().optional(),
  frequencyCustom: z.string().max(200).optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  startDate: ymd.optional(),
  endDate: ymd.optional(),
  estimatedTime: z.number().min(0).max(9999).optional(),
  notes: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
  customFields,
};

const createSchema = z.object({
  ...editableFields,
  title: z.string().trim().min(1).max(200),
  projectId: objectIdSchema,
});

const patchSchema = z.object({
  ...editableFields,
  id: objectIdSchema,
});

const deleteSchema = z.object({
  id: objectIdSchema,
});

/** The active range must not end before it starts (either bound may be empty). */
function rangeError(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    return jsonError(400, "The end date is before the start date");
  }
  return null;
}

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

    const bad = rangeError(body.data.startDate, body.data.endDate);
    if (bad) return bad;

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
      frequencies: body.data.frequencies || [],
      monthly: body.data.monthly || [],
      autoSchedule: body.data.autoSchedule || false,
      frequencyCustom: body.data.frequencyCustom || "",
      startMinute: body.data.startMinute ?? null,
      startDate: body.data.startDate || "",
      endDate: body.data.endDate || "",
      estimatedTime: body.data.estimatedTime || 0,
      notes: body.data.notes || "",
      color: body.data.color || "",
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

    const filter = { _id: id, ...identityQuery(ident.data) };

    // Check the date range against what is stored when only one bound is sent.
    if (updates.startDate !== undefined || updates.endDate !== undefined) {
      const current = await RoutineTask.findOne(filter).select({ startDate: 1, endDate: 1 });
      if (!current) return jsonError(404, "Routine task not found");
      const bad = rangeError(
        updates.startDate !== undefined ? updates.startDate : current.startDate,
        updates.endDate !== undefined ? updates.endDate : current.endDate,
      );
      if (bad) return bad;
    }

    const task = await RoutineTask.findOneAndUpdate(filter, { $set: updates }, { new: true });

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
