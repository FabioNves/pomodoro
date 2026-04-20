import { connectToDB } from "@/lib/db";
import WeekPlan from "@/models/WeekPlan";
import { z } from "zod";
import {
  validateIdentityHeaders,
  validateJsonBody,
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

const addTaskSchema = z.object({
  weekPlanId: objectIdSchema,
  dayOfWeek: z.number().min(0).max(6),
  routineTaskId: objectIdSchema.optional(),
  taskName: z.string().trim().min(1).max(200),
  estimatedTime: z.number().min(0).max(9999).optional(),
});

const patchTaskSchema = z.object({
  weekPlanId: objectIdSchema,
  dayOfWeek: z.number().min(0).max(6),
  taskId: z.string(),
  completed: z.boolean().optional(),
  taskName: z.string().trim().min(1).max(200).optional(),
  estimatedTime: z.number().min(0).max(9999).optional(),
});

const deleteTaskSchema = z.object({
  weekPlanId: objectIdSchema,
  dayOfWeek: z.number().min(0).max(6),
  taskId: z.string(),
});

export async function POST(req) {
  try {
    const body = await validateJsonBody(req, addTaskSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const plan = await WeekPlan.findOne({
      _id: body.data.weekPlanId,
      ...identityQuery(ident.data),
    });

    if (!plan) return jsonError(404, "Week plan not found");

    const day = plan.days.find((d) => d.dayOfWeek === body.data.dayOfWeek);
    if (!day) return jsonError(400, "Invalid day");

    const maxOrder = day.tasks.length
      ? Math.max(...day.tasks.map((t) => t.order))
      : -1;

    day.tasks.push({
      routineTask: body.data.routineTaskId || null,
      taskName: body.data.taskName,
      estimatedTime: body.data.estimatedTime || 0,
      completed: false,
      order: maxOrder + 1,
    });

    await plan.save();

    return Response.json(plan, { status: 201 });
  } catch (error) {
    console.error("Error adding week task:", error);
    return jsonError(500, "Error adding week task");
  }
}

export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchTaskSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const plan = await WeekPlan.findOne({
      _id: body.data.weekPlanId,
      ...identityQuery(ident.data),
    });

    if (!plan) return jsonError(404, "Week plan not found");

    const day = plan.days.find((d) => d.dayOfWeek === body.data.dayOfWeek);
    if (!day) return jsonError(400, "Invalid day");

    const task = day.tasks.id(body.data.taskId);
    if (!task) return jsonError(404, "Task not found");

    if (typeof body.data.completed === "boolean")
      task.completed = body.data.completed;
    if (body.data.taskName) task.taskName = body.data.taskName;
    if (typeof body.data.estimatedTime === "number")
      task.estimatedTime = body.data.estimatedTime;

    await plan.save();

    return Response.json(plan);
  } catch (error) {
    console.error("Error updating week task:", error);
    return jsonError(500, "Error updating week task");
  }
}

export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteTaskSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const plan = await WeekPlan.findOne({
      _id: body.data.weekPlanId,
      ...identityQuery(ident.data),
    });

    if (!plan) return jsonError(404, "Week plan not found");

    const day = plan.days.find((d) => d.dayOfWeek === body.data.dayOfWeek);
    if (!day) return jsonError(400, "Invalid day");

    day.tasks = day.tasks.filter((t) => String(t._id) !== body.data.taskId);

    await plan.save();

    return Response.json(plan);
  } catch (error) {
    console.error("Error deleting week task:", error);
    return jsonError(500, "Error deleting week task");
  }
}
