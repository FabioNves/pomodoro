import { connectToDB } from "@/lib/db";
import Task from "@/models/Task";
import { z } from "zod";
import {
  getIdentityHeaders,
  validateIdentityHeaders,
  validateJsonBody,
  validateSearchParams,
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

const tasksQuerySchema = z.object({
  projectId: objectIdSchema.optional(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: objectIdSchema,
  parentTaskId: objectIdSchema.optional(),
});

const patchTaskSchema = z.object({
  id: objectIdSchema,
  completed: z.boolean().optional(),
});

const deleteTaskSchema = z.object({
  id: objectIdSchema,
});

// GET /api/tasks?projectId=...
export async function GET(req) {
  try {
    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const queryValidation = validateSearchParams(req, tasksQuerySchema);
    if (!queryValidation.ok) return queryValidation.response;

    const { projectId } = queryValidation.data;

    await connectToDB();

    const query = {
      ...identityQuery(ident.data),
      ...(projectId ? { project: projectId } : {}),
    };

    const tasks = await Task.find(query).sort({ order: 1, createdAt: 1 });
    return Response.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return Response.json({ error: "Error fetching tasks" }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createTaskSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { title, projectId, parentTaskId } = body.data;
    const identity = getIdentityHeaders(req);
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const scopeQuery = {
      ...identQuery,
      project: projectId,
      parentTask: parentTaskId || null,
      completed: false,
    };

    const maxInScope = await Task.find(scopeQuery)
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });

    const nextOrder = (maxInScope?.[0]?.order ?? -1) + 1 || 0;

    const task = await Task.create({
      title,
      project: projectId,
      parentTask: parentTaskId || null,
      order: nextOrder,
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return Response.json({ error: "Error creating task" }, { status: 500 });
  }
}

// PATCH /api/tasks
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchTaskSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { id, completed } = body.data;
    const identity = getIdentityHeaders(req);
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    if (typeof completed === "boolean") {
      const existing = await Task.findOne({ _id: id, ...identQuery });
      if (!existing) {
        return Response.json({ error: "Task not found" }, { status: 404 });
      }

      const completionChanged = Boolean(existing.completed) !== completed;
      if (completionChanged) {
        const scopeQuery = {
          ...identQuery,
          project: existing.project,
          parentTask: existing.parentTask || null,
          completed,
        };

        const maxInScope = await Task.find(scopeQuery)
          .sort({ order: -1 })
          .limit(1)
          .select({ order: 1 });

        const nextOrder = (maxInScope?.[0]?.order ?? -1) + 1 || 0;

        const updated = await Task.findOneAndUpdate(
          { _id: id, ...identQuery },
          { $set: { completed, order: nextOrder } },
          { new: true }
        );

        return Response.json(updated);
      }
    }

    const updated = await Task.findOneAndUpdate(
      { _id: id, ...identQuery },
      { $set: { ...(typeof completed === "boolean" ? { completed } : {}) } },
      { new: true }
    );

    if (!updated) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating task:", error);
    return Response.json({ error: "Error updating task" }, { status: 500 });
  }
}

// DELETE /api/tasks
// Body: { id }
export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteTaskSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { id } = body.data;
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const root = await Task.findOne({ _id: id, ...identQuery }).select({
      _id: 1,
    });

    if (!root) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    // Cascade delete: delete task + all descendants
    const toVisit = [root._id];
    const allIds = new Set([String(root._id)]);

    while (toVisit.length) {
      const batch = toVisit.splice(0, 50);
      const children = await Task.find({
        ...identQuery,
        parentTask: { $in: batch },
      })
        .select({ _id: 1 })
        .limit(5000);

      for (const c of children) {
        const sid = String(c._id);
        if (allIds.has(sid)) continue;
        allIds.add(sid);
        toVisit.push(c._id);
      }

      if (allIds.size > 10000) {
        return Response.json(
          { error: "Too many descendant tasks to delete" },
          { status: 400 }
        );
      }
    }

    await Task.deleteMany({
      ...identQuery,
      _id: { $in: Array.from(allIds) },
    });

    return Response.json({ ok: true, deleted: allIds.size });
  } catch (error) {
    console.error("Error deleting task:", error);
    return Response.json({ error: "Error deleting task" }, { status: 500 });
  }
}
