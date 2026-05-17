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

const moveSchema = z.object({
  weekPlanId: objectIdSchema,
  fromDayOfWeek: z.number().min(0).max(6),
  toDayOfWeek: z.number().min(0).max(6),
  taskId: z.string(),
  toProjectId: objectIdSchema.nullable().optional(),
});

export async function POST(req) {
  try {
    const body = await validateJsonBody(req, moveSchema);
    if (!body.ok) return body.response;

    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const plan = await WeekPlan.findOne({
      _id: body.data.weekPlanId,
      ...identityQuery(ident.data),
    });

    if (!plan) return jsonError(404, "Week plan not found");

    const fromDay = plan.days.find(
      (d) => d.dayOfWeek === body.data.fromDayOfWeek,
    );
    const toDay = plan.days.find((d) => d.dayOfWeek === body.data.toDayOfWeek);
    if (!fromDay || !toDay) return jsonError(400, "Invalid day");

    const taskIdx = fromDay.tasks.findIndex(
      (t) => String(t._id) === body.data.taskId,
    );
    if (taskIdx < 0) return jsonError(404, "Task not found");

    const task = fromDay.tasks[taskIdx];
    const snapshot = {
      routineTask: task.routineTask || null,
      project:
        body.data.toProjectId !== undefined
          ? body.data.toProjectId || null
          : task.project || null,
      taskName: task.taskName,
      estimatedTime: task.estimatedTime || 0,
      notes: task.notes || "",
      completed: !!task.completed,
    };

    fromDay.tasks.splice(taskIdx, 1);

    const maxOrder = toDay.tasks.length
      ? Math.max(...toDay.tasks.map((t) => t.order))
      : -1;

    toDay.tasks.push({ ...snapshot, order: maxOrder + 1 });

    await plan.save();

    return Response.json(plan);
  } catch (error) {
    console.error("Error moving week task:", error);
    return jsonError(500, "Error moving week task");
  }
}
