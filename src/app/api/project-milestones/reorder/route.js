import { connectToDB } from "@/lib/db";
import ProjectMilestone from "@/models/ProjectMilestone";
import { z } from "zod";
import {
  validateIdentityHeaders,
  validateJsonBody,
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

const reorderSchema = z.object({
  projectId: objectIdSchema,
  orderedIds: z.array(objectIdSchema).min(1).max(200),
});

// PATCH /api/project-milestones/reorder
// Body: { projectId, orderedIds } — the full order of the project's milestones.
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, reorderSchema);
    if (!body.ok) return body.response;
    const ident = await validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const identQuery = identityQuery(ident.data);
    const { projectId, orderedIds } = body.data;
    await connectToDB();

    const ops = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, project: projectId, ...identQuery },
        update: { $set: { order: index } },
      },
    }));
    const result = await ProjectMilestone.bulkWrite(ops, { ordered: false });

    return Response.json({
      ok: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error reordering milestones:", error);
    return Response.json({ error: "Error reordering milestones" }, { status: 500 });
  }
}
