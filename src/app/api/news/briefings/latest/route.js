import { z } from "zod";
import { connectToDB } from "@/lib/db";
import Briefing from "@/models/Briefing";
import { validateSearchParams, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { markStaleBriefings } from "@/lib/news/generate";
import { loadBriefingDto } from "@/app/api/news/briefings/route";

// GET /api/news/briefings/latest?kind=daily
// The newest briefing of that kind (generating, ready, empty or failed), so
// the dashboard can show progress and errors as well as content.
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  // `kinds` takes a comma-separated list so the dashboard's Daily view can
  // show whichever is newer, a daily or a custom-schedule briefing.
  const params = validateSearchParams(
    req,
    z.object({
      kind: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
      kinds: z
        .string()
        .max(40)
        .optional()
        .transform((v) =>
          (v || "")
            .split(",")
            .map((k) => k.trim())
            .filter((k) => ["daily", "weekly", "monthly", "custom"].includes(k)),
        ),
    }),
  );
  if (!params.ok) return params.response;

  try {
    await connectToDB();
    await markStaleBriefings(auth.userId);
    const filter = { user: auth.userId };
    if (params.data.kinds?.length) filter.kind = { $in: params.data.kinds };
    else if (params.data.kind) filter.kind = params.data.kind;
    const briefing = await Briefing.findOne(filter).sort({ createdAt: -1 });
    if (!briefing) return Response.json({ briefing: null });
    return Response.json({ briefing: await loadBriefingDto(auth.userId, briefing) });
  } catch (error) {
    console.error("[news] latest briefing failed", error);
    return jsonError(500, "Could not load the latest briefing");
  }
}
