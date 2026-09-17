import { z } from "zod";
import { requireUser } from "@/lib/sessionAuth";
import { jsonError, validateJsonBody } from "@/utils/apiValidation";
import {
  AiError,
  isOpenAiConfigured,
  suggestMilestones,
  suggestStructure,
  suggestTasks,
} from "@/lib/ai/planning";

// AI suggestions for a project's milestones and tasks. Nothing is stored:
// the browser shows the result in a review screen and only the items the
// user keeps are sent to /api/projects/structure.
//
// Suggestions cost money, so unlike the rest of the planner this route asks
// for a verified session (signed-in users only).

const suggestSchema = z.object({
  kind: z.enum(["milestones", "tasks", "structure"]),
  projectName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  goal: z.string().trim().max(1500).optional(),
  milestone: z
    .object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(500).optional(),
    })
    .optional(),
  existingMilestones: z.array(z.string().trim().max(80)).max(50).optional(),
  existingTasks: z.array(z.string().trim().max(200)).max(100).optional(),
});

function aiErrorResponse(error) {
  if (!(error instanceof AiError)) return null;
  const status =
    error.code === "not_configured"
      ? 503
      : error.code === "rate_limited"
        ? 429
        : error.code === "timeout"
          ? 504
          : 502;
  const message =
    error.code === "not_configured"
      ? "AI suggestions are not set up on this server."
      : error.code === "rate_limited"
        ? "The AI service is busy. Try again in a moment."
        : error.code === "timeout"
          ? "The AI service took too long. Try again."
          : "The AI service could not produce suggestions.";
  return Response.json({ error: message, code: error.code }, { status });
}

// POST /api/projects/suggest
export async function POST(req) {
  const auth = await requireUser(req, { signInMessage: "Sign in to use AI suggestions.", feature: "ai_project_planning" });
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(req, suggestSchema);
  if (!body.ok) return body.response;

  if (!isOpenAiConfigured()) {
    return Response.json(
      { error: "AI suggestions are not set up on this server.", code: "not_configured" },
      { status: 503 },
    );
  }

  const { kind, projectName, description, goal, milestone, existingMilestones, existingTasks } =
    body.data;

  try {
    if (kind === "milestones") {
      const { milestones, model } = await suggestMilestones({
        projectName,
        description,
        goal,
        existingMilestones,
      });
      return Response.json({ milestones, model });
    }
    if (kind === "tasks") {
      if (!milestone) return jsonError(400, "A milestone is required to suggest tasks.");
      const { tasks, model } = await suggestTasks({
        projectName,
        description,
        goal,
        milestone,
        otherMilestones: existingMilestones,
        existingTasks,
      });
      return Response.json({ tasks, model });
    }
    const { milestones, model } = await suggestStructure({ projectName, description, goal });
    return Response.json({ milestones, model });
  } catch (error) {
    const known = aiErrorResponse(error);
    if (known) return known;
    console.error("Error suggesting project structure:", error);
    return jsonError(500, "Error generating suggestions");
  }
}
