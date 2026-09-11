import { z } from "zod";
import { after } from "next/server";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { startBriefing, runBriefingGeneration, GenerationError } from "@/lib/news/generate";
import { briefingSummaryDto } from "@/lib/news/serialize";

// Generation runs after the response is sent (next/server after()), so it
// needs the route's full duration budget. 300 s is the Vercel maximum on
// every plan with fluid compute.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/news/briefings/generate  { kind: "daily" | "weekly" | "custom" }
// Creates the briefing (status "generating") and returns 202 at once; the
// client polls GET /api/news/briefings?id=… until it is ready.
export async function POST(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(req, z.object({ kind: z.enum(["daily", "weekly", "monthly", "custom"]).default("daily") }));
  if (!body.ok) return body.response;

  let briefing;
  try {
    briefing = await startBriefing({ userId: auth.userId, kind: body.data.kind, trigger: "manual" });
  } catch (error) {
    if (error instanceof GenerationError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[news] could not start briefing", error);
    return jsonError(500, "Could not start the briefing");
  }

  const id = briefing._id;
  after(async () => {
    try {
      await runBriefingGeneration(id);
    } catch (error) {
      console.error("[news] generation crashed", error);
    }
  });

  return Response.json({ briefing: briefingSummaryDto(briefing) }, { status: 202 });
}
