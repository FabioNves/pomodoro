import { z } from "zod";
import { after } from "next/server";
import { connectToDB } from "@/lib/db";
import Briefing from "@/models/Briefing";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { continuationChain, isInternalRequest, markStaleBriefings, runNextEdition } from "@/lib/news/generate";
import { briefingSummaryDto } from "@/lib/news/serialize";

// Runs the next edition of a briefing in a fresh invocation, with its own
// 300 s. Called in two ways:
//   - by the server itself, when an invocation hands off the next edition
//     ("Authorization: Bearer $CRON_SECRET");
//   - by the owner's browser, when a run has stalled because a hand-off was
//     lost (or CRON_SECRET is not set, so there is no hand-off at all).
// Editions are claimed atomically, so a duplicate call never runs one twice.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id") });

// POST /api/news/briefings/continue  { id }
export async function POST(req) {
  const internal = isInternalRequest(req);
  let userId = null;
  if (!internal) {
    const auth = requireUser(req);
    if (!auth.ok) return auth.response;
    userId = auth.userId;
  }

  const body = await validateJsonBody(req, bodySchema);
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const filter = { _id: body.data.id };
    if (userId) filter.user = userId;
    if (userId) await markStaleBriefings(userId);
    const briefing = await Briefing.findOne(filter);
    if (!briefing) return jsonError(404, "Briefing not found");

    const summary = briefingSummaryDto(briefing);
    if (briefing.status !== "generating") {
      return Response.json({ briefing: summary, resumed: false });
    }
    // A reader may only restart a run that has actually stopped moving;
    // while an edition is working, its own invocation hands off the next.
    if (!internal && !summary.stalled) {
      return Response.json({ briefing: summary, resumed: false });
    }

    const chain = continuationChain(req);
    const id = briefing._id;
    after(async () => {
      try {
        await runNextEdition(id, { chain });
      } catch (error) {
        console.error("[news] continuation crashed", error);
      }
    });
    return Response.json({ briefing: summary, resumed: true }, { status: 202 });
  } catch (error) {
    console.error("[news] continue failed", error);
    return jsonError(500, "Could not continue the briefing");
  }
}
