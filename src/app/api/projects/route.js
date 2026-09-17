import { connectToDB } from "@/lib/db";
import Project from "@/models/Project";
import Task from "@/models/Task";
import ProjectMilestone from "@/models/ProjectMilestone";
import { z } from "zod";
import {
  getIdentityHeaders,
  validateIdentityHeaders,
  validateJsonBody,
} from "@/utils/apiValidation";

function identityQuery({ userId, sessionId }) {
  if (userId) return { user: userId };
  if (sessionId) return { sessionId };
  return null;
}

const ALLOWED_HEADER_COLORS = new Set([
  "blue",
  "green",
  "red",
  "orange",
  "purple",
  "gray",
]);

const headerColorSchema = z
  .enum(["blue", "green", "red", "orange", "purple", "gray"])
  .optional();

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const dateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().date(),
  z.null(),
]);

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  template: z.string().trim().max(60).nullable().optional(),
  headerColor: headerColorSchema,
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

const patchProjectSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(1000).optional(),
  headerColor: headerColorSchema,
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

const toDate = (v) => (v ? new Date(v) : null);

/** Null when the span is fine, otherwise the error to return. */
function invalidSpan(startDate, endDate) {
  if (!startDate || !endDate) return null;
  return new Date(endDate) < new Date(startDate) ? "End date is before start date" : null;
}

const deleteProjectSchema = z.object({
  id: objectIdSchema,
});

// POST /api/projects
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createProjectSchema);
    if (!body.ok) return body.response;

    const identityValidation = await validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { name, description, template, headerColor, startDate, endDate } = body.data;
    const identity = getIdentityHeaders(req);

    if (headerColor && !ALLOWED_HEADER_COLORS.has(headerColor)) {
      return Response.json({ error: "Invalid headerColor" }, { status: 400 });
    }
    const spanError = invalidSpan(startDate, endDate);
    if (spanError) return Response.json({ error: spanError }, { status: 400 });

    await connectToDB();

    const project = await Project.create({
      name,
      description: description || "",
      template: template || null,
      ...(headerColor ? { headerColor } : {}),
      startDate: toDate(startDate),
      endDate: toDate(endDate),
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return Response.json({ error: "Error creating project" }, { status: 500 });
  }
}

// PATCH /api/projects
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchProjectSchema);
    if (!body.ok) return body.response;

    const identityValidation = await validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { id, name, description, headerColor, startDate, endDate } = body.data;
    const identQuery = identityQuery(identityValidation.data);
    const has = (k) => Object.prototype.hasOwnProperty.call(body.data, k);

    if (headerColor && !ALLOWED_HEADER_COLORS.has(headerColor)) {
      return Response.json({ error: "Invalid headerColor" }, { status: 400 });
    }

    await connectToDB();

    if (has("startDate") || has("endDate")) {
      // Validate the span against the stored dates when only one side changes.
      const existing = await Project.findOne({ _id: id, ...identQuery }).select({
        startDate: 1,
        endDate: 1,
      });
      if (!existing) {
        return Response.json({ error: "Project not found" }, { status: 404 });
      }
      const spanError = invalidSpan(
        has("startDate") ? startDate : existing.startDate,
        has("endDate") ? endDate : existing.endDate,
      );
      if (spanError) return Response.json({ error: spanError }, { status: 400 });
    }

    const updated = await Project.findOneAndUpdate(
      { _id: id, ...identQuery },
      {
        $set: {
          ...(headerColor ? { headerColor } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(has("startDate") ? { startDate: toDate(startDate) } : {}),
          ...(has("endDate") ? { endDate: toDate(endDate) } : {}),
        },
      },
      { new: true }
    );

    if (!updated) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating project:", error);
    return Response.json({ error: "Error updating project" }, { status: 500 });
  }
}

// GET /api/projects
export async function GET(req) {
  try {
    const identityValidation = await validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const projects = await Project.find(identQuery).sort({ createdAt: 1 });
    return Response.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return Response.json({ error: "Error fetching projects" }, { status: 500 });
  }
}

// DELETE /api/projects
export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteProjectSchema);
    if (!body.ok) return body.response;

    const identityValidation = await validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { id } = body.data;
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const project = await Project.findOne({ _id: id, ...identQuery });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    await Task.deleteMany({ project: id, ...identQuery });
    await ProjectMilestone.deleteMany({ project: id, ...identQuery });
    await Project.deleteOne({ _id: id, ...identQuery });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return Response.json({ error: "Error deleting project" }, { status: 500 });
  }
}
