import { connectToDB } from "@/lib/db";
import Project from "@/models/Project";
import ProjectMilestone from "@/models/ProjectMilestone";
import Task from "@/models/Task";
import { MILESTONE_STATUS_KEYS } from "@/lib/milestones";
import { z } from "zod";
import {
  validateIdentityHeaders,
  validateJsonBody,
  validateSearchParams,
} from "@/utils/apiValidation";

// Milestones of planner projects. They follow the same identity model as
// /api/projects and /api/tasks (a signed-in user id or an anonymous session
// id) because they are part of the same planner data.

function identityQuery({ userId, sessionId }) {
  if (userId) return { user: userId };
  if (sessionId) return { sessionId };
  return null;
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const dateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().date(),
  z.null(),
]);

const statusSchema = z.enum(MILESTONE_STATUS_KEYS);

const listSchema = z.object({
  projectId: objectIdSchema.optional(),
});

const createSchema = z.object({
  projectId: objectIdSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  status: statusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

const patchSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  status: statusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  order: z.number().int().min(0).optional(),
});

const toDate = (v) => (v ? new Date(v) : null);

/** Null when the span is fine, otherwise the error to return. */
function invalidSpan(startDate, endDate) {
  if (!startDate || !endDate) return null;
  return new Date(endDate) < new Date(startDate) ? "End date is before start date" : null;
}

const deleteSchema = z.object({
  id: objectIdSchema,
});

/** Serialise a milestone with the task counts its progress derives from. */
function withCounts(milestone, counts) {
  const c = counts.get(String(milestone._id)) || { total: 0, done: 0 };
  const obj = milestone.toObject ? milestone.toObject() : milestone;
  return { ...obj, taskCount: c.total, completedTaskCount: c.done };
}

async function countTasks(identQuery, milestoneIds) {
  const counts = new Map();
  if (!milestoneIds.length) return counts;
  const rows = await Task.aggregate([
    { $match: { ...identQuery, milestone: { $in: milestoneIds } } },
    {
      $group: {
        _id: "$milestone",
        total: { $sum: 1 },
        done: { $sum: { $cond: ["$completed", 1, 0] } },
      },
    },
  ]);
  for (const r of rows) counts.set(String(r._id), { total: r.total, done: r.done });
  return counts;
}

// GET /api/project-milestones?projectId=...
export async function GET(req) {
  try {
    const ident = await validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;
    const query = validateSearchParams(req, listSchema);
    if (!query.ok) return query.response;

    const identQuery = identityQuery(ident.data);
    await connectToDB();

    const milestones = await ProjectMilestone.find({
      ...identQuery,
      ...(query.data.projectId ? { project: query.data.projectId } : {}),
    }).sort({ project: 1, order: 1, createdAt: 1 });

    const counts = await countTasks(
      identQuery,
      milestones.map((m) => m._id),
    );
    return Response.json(milestones.map((m) => withCounts(m, counts)));
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return Response.json({ error: "Error fetching milestones" }, { status: 500 });
  }
}

// POST /api/project-milestones
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createSchema);
    if (!body.ok) return body.response;
    const ident = await validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);
    const { projectId, name, description, status, startDate, endDate } = body.data;
    const spanError = invalidSpan(startDate, endDate);
    if (spanError) return Response.json({ error: spanError }, { status: 400 });
    await connectToDB();

    const project = await Project.findOne({ _id: projectId, ...identQuery }).select({ _id: 1 });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const last = await ProjectMilestone.find({ ...identQuery, project: projectId })
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });
    const nextOrder = (last?.[0]?.order ?? -1) + 1;

    const milestone = await ProjectMilestone.create({
      name,
      description: description || "",
      project: projectId,
      order: nextOrder,
      status: status || "planned",
      startDate: toDate(startDate),
      endDate: toDate(endDate),
      completedAt: status === "completed" ? new Date() : null,
      ...(ident.data.userId
        ? { user: ident.data.userId, isTemporary: false }
        : { sessionId: ident.data.sessionId, isTemporary: true }),
    });

    return Response.json(withCounts(milestone, new Map()), { status: 201 });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return Response.json({ error: "Error creating milestone" }, { status: 500 });
  }
}

// PATCH /api/project-milestones
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchSchema);
    if (!body.ok) return body.response;
    const ident = await validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);
    const { id, name, description, status, startDate, endDate, order } = body.data;
    const has = (k) => Object.prototype.hasOwnProperty.call(body.data, k);
    await connectToDB();

    const existing = await ProjectMilestone.findOne({ _id: id, ...identQuery });
    if (!existing) {
      return Response.json({ error: "Milestone not found" }, { status: 404 });
    }

    const spanError = invalidSpan(
      has("startDate") ? startDate : existing.startDate,
      has("endDate") ? endDate : existing.endDate,
    );
    if (spanError) return Response.json({ error: spanError }, { status: 400 });

    const set = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(has("startDate") ? { startDate: toDate(startDate) } : {}),
      ...(has("endDate") ? { endDate: toDate(endDate) } : {}),
      ...(order !== undefined ? { order } : {}),
    };
    if (status !== undefined && status !== existing.status) {
      set.status = status;
      set.completedAt = status === "completed" ? new Date() : null;
    }

    const updated = await ProjectMilestone.findOneAndUpdate(
      { _id: id, ...identQuery },
      { $set: set },
      { new: true },
    );
    const counts = await countTasks(identQuery, [updated._id]);
    return Response.json(withCounts(updated, counts));
  } catch (error) {
    console.error("Error updating milestone:", error);
    return Response.json({ error: "Error updating milestone" }, { status: 500 });
  }
}

// DELETE /api/project-milestones — tasks keep existing and become unassigned.
export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteSchema);
    if (!body.ok) return body.response;
    const ident = await validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);
    const { id } = body.data;
    await connectToDB();

    const milestone = await ProjectMilestone.findOne({ _id: id, ...identQuery }).select({ _id: 1 });
    if (!milestone) {
      return Response.json({ error: "Milestone not found" }, { status: 404 });
    }

    await Task.updateMany({ ...identQuery, milestone: id }, { $set: { milestone: null } });
    await ProjectMilestone.deleteOne({ _id: id, ...identQuery });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return Response.json({ error: "Error deleting milestone" }, { status: 500 });
  }
}
