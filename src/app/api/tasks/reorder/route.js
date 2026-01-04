import { connectToDB } from "@/lib/db";
import Task from "@/models/Task";
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

const reorderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z
          .string()
          .trim()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
        order: z.number().int().min(0),
        projectId: z
          .string()
          .trim()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid projectId")
          .optional(),
      })
    )
    .min(1)
    .max(200),
});

// PATCH /api/tasks/reorder
// Body: { updates: [{ id, order, projectId? }] }
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, reorderSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const { updates } = body.data;
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const ops = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, ...identQuery },
        update: {
          $set: {
            order: u.order,
            ...(u.projectId ? { project: u.projectId } : {}),
          },
        },
      },
    }));

    const result = await Task.bulkWrite(ops, { ordered: false });

    return Response.json({
      ok: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return Response.json({ error: "Error reordering tasks" }, { status: 500 });
  }
}
