import { z } from "zod";
import { after } from "next/server";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { startBriefing, runNextEdition, continuationChain, GenerationError } from "@/lib/news/generate";
import { briefingSummaryDto } from "@/lib/news/serialize";
import { MAX_EDITIONS } from "@/lib/news/locales";

// Generation runs after the response is sent (next/server after()), so it
// needs the route's full duration budget. 300 s is the Vercel maximum on
// every plan with fluid compute.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/news/briefings/generate
//   { kind: "daily" | "weekly" | "monthly" | "custom", editionKeys?: string[] }
// Creates the briefing (status "generating") and returns 202 at once. This
// invocation builds the first edition; each further edition runs in a fresh
// invocation (POST /api/news/briefings/continue). The client polls
// GET /api/news/briefings?id=… until every edition has finished.
//
// editionKeys limits the run to those editions of the kind, so a reader can
// refresh one region without rebuilding the rest.
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(
    req,
    z.object({
      kind: z.enum(["daily", "weekly", "monthly", "custom"]).default("daily"),
      editionKeys: z.array(z.string().trim().min(1).max(40)).max(MAX_EDITIONS).optional(),
    }),
  );
  if (!body.ok) return body.response;

  let briefing;
  try {
    briefing = await startBriefing({
      userId: auth.userId,
      kind: body.data.kind,
      trigger: "manual",
      editionKeys: body.data.editionKeys,
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[news] could not start briefing", error);
    return jsonError(500, "Could not start the briefing");
  }

  const id = briefing._id;
  const chain = continuationChain(req);
  after(async () => {
    try {
      await runNextEdition(id, { chain });
    } catch (error) {
      console.error("[news] generation crashed", error);
    }
  });

  return Response.json({ briefing: briefingSummaryDto(briefing) }, { status: 202 });
}
