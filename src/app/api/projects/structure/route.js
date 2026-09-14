import { connectToDB } from "@/lib/db";
import Project from "@/models/Project";
import ProjectMilestone from "@/models/ProjectMilestone";
import Task from "@/models/Task";
import { MILESTONE_STATUS_KEYS } from "@/lib/milestones";
import { z } from "zod";
import {
  validateIdentityHeaders,
  validateJsonBody,
} from "@/utils/apiValidation";

// Adds a reviewed structure (milestones with tasks, or tasks for an existing
// milestone) to a project in one request. Used after the review screen of
// the project creation flow, the template picker and the AI suggestions.

function identityQuery({ userId, sessionId }) {
  if (userId) return { user: userId };
  if (sessionId) return { sessionId };
  return null;
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const dateSchema = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.null()])
  .optional();

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startDate: dateSchema,
  endDate: dateSchema,
});

const milestoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  status: z.enum(MILESTONE_STATUS_KEYS).optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  tasks: z.array(taskSchema).max(50).optional(),
});

const toDate = (v) => (v ? new Date(v) : null);

/** True when both dates are set and the end comes before the start. */
const badSpan = (s, e) => Boolean(s && e && new Date(e) < new Date(s));

const structureSchema = z.object({
  projectId: objectIdSchema,
  milestones: z.array(milestoneSchema).max(50).optional(),
  // Tasks to add straight to one existing milestone (or unassigned when null).
  milestoneId: objectIdSchema.nullable().optional(),
  tasks: z.array(taskSchema).max(100).optional(),
});

// POST /api/projects/structure
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, structureSchema);
    if (!body.ok) return body.response;
    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);
    const owner = ident.data.userId
      ? { user: ident.data.userId, isTemporary: false }
      : { sessionId: ident.data.sessionId, isTemporary: true };
    const { projectId, milestones = [], milestoneId, tasks = [] } = body.data;
    const allTasks = [...tasks, ...milestones.flatMap((m) => m.tasks || [])];
    if (
      milestones.some((m) => badSpan(m.startDate, m.endDate)) ||
      allTasks.some((t) => badSpan(t.startDate, t.endDate))
    ) {
      return Response.json({ error: "End date is before start date" }, { status: 400 });
    }
    await connectToDB();

    const project = await Project.findOne({ _id: projectId, ...identQuery }).select({ _id: 1 });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const createdMilestones = [];
    const createdTasks = [];

    const nextTaskOrder = async () => {
      const last = await Task.find({
        ...identQuery,
        project: projectId,
        parentTask: null,
        completed: false,
      })
        .sort({ order: -1 })
        .limit(1)
        .select({ order: 1 });
      return (last?.[0]?.order ?? -1) + 1;
    };

    let taskOrder = await nextTaskOrder();

    const insertTasks = async (list, milestone) => {
      if (!list.length) return;
      const docs = list.map((t) => ({
        title: t.title,
        project: projectId,
        milestone: milestone || null,
        parentTask: null,
        order: taskOrder++,
        startDate: toDate(t.startDate),
        endDate: toDate(t.endDate),
        ...owner,
      }));
      const inserted = await Task.insertMany(docs);
      createdTasks.push(...inserted);
    };

    if (milestones.length) {
      const last = await ProjectMilestone.find({ ...identQuery, project: projectId })
        .sort({ order: -1 })
        .limit(1)
        .select({ order: 1 });
      let order = (last?.[0]?.order ?? -1) + 1;

      for (const m of milestones) {
        const milestone = await ProjectMilestone.create({
          name: m.name,
          description: m.description || "",
          project: projectId,
          order: order++,
          status: m.status || "planned",
          startDate: toDate(m.startDate),
          endDate: toDate(m.endDate),
          completedAt: m.status === "completed" ? new Date() : null,
          ...owner,
        });
        createdMilestones.push(milestone);
        await insertTasks(m.tasks || [], milestone._id);
      }
    }

    if (tasks.length) {
      if (milestoneId) {
        const target = await ProjectMilestone.findOne({
          _id: milestoneId,
          project: projectId,
          ...identQuery,
        }).select({ _id: 1 });
        if (!target) {
          return Response.json({ error: "Milestone not found" }, { status: 404 });
        }
      }
      await insertTasks(tasks, milestoneId || null);
    }

    return Response.json(
      {
        milestones: createdMilestones.map((m) => ({
          ...m.toObject(),
          taskCount: createdTasks.filter((t) => String(t.milestone) === String(m._id)).length,
          completedTaskCount: 0,
        })),
        tasks: createdTasks,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error adding project structure:", error);
    return Response.json({ error: "Error adding project structure" }, { status: 500 });
  }
}
