import { z } from "zod";
import { connectToDB } from "@/lib/db";
import Briefing from "@/models/Briefing";
import BriefingStory from "@/models/BriefingStory";
import SavedStory from "@/models/SavedStory";
import NewsFeedback from "@/models/NewsFeedback";
import { validateSearchParams, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { markStaleBriefings } from "@/lib/news/generate";
import { briefingDto, briefingSummaryDto } from "@/lib/news/serialize";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/** Load one briefing with its stories and the user's saved/feedback state. */
export async function loadBriefingDto(userId, briefing) {
  const stories = await BriefingStory.find({ briefing: briefing._id, user: userId }).sort({ rank: 1 }).lean();
  const ids = stories.map((s) => s._id);
  const [saved, feedback] = await Promise.all([
    SavedStory.find({ user: userId, story: { $in: ids } }).select({ story: 1 }).lean(),
    NewsFeedback.find({ user: userId, story: { $in: ids } }).select({ story: 1, value: 1 }).lean(),
  ]);
  return briefingDto(briefing, stories, {
    savedIds: new Set(saved.map((s) => String(s.story))),
    feedbackById: new Map(feedback.map((f) => [String(f.story), f.value])),
  });
}

// GET /api/news/briefings?id=…            one briefing with its stories
// GET /api/news/briefings?kind=daily&limit=20&before=<ISO date>   history
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const params = validateSearchParams(
    req,
    z.object({
      id: objectId.optional(),
      kind: z.enum(["daily", "weekly", "monthly", "custom", "all"]).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
      before: z.string().datetime().optional(),
      status: z.enum(["ready", "empty", "failed", "generating", "all"]).optional(),
    }),
  );
  if (!params.ok) return params.response;

  try {
    await connectToDB();
    await markStaleBriefings(auth.userId);

    if (params.data.id) {
      const briefing = await Briefing.findOne({ _id: params.data.id, user: auth.userId });
      if (!briefing) return jsonError(404, "Briefing not found");
      return Response.json({ briefing: await loadBriefingDto(auth.userId, briefing) });
    }

    const filter = { user: auth.userId };
    if (params.data.kind && params.data.kind !== "all") filter.kind = params.data.kind;
    if (params.data.status && params.data.status !== "all") filter.status = params.data.status;
    if (params.data.before) filter.createdAt = { $lt: new Date(params.data.before) };
    const limit = params.data.limit || 20;
    const briefings = await Briefing.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const hasMore = briefings.length > limit;
    return Response.json({
      briefings: briefings.slice(0, limit).map(briefingSummaryDto),
      hasMore,
    });
  } catch (error) {
    console.error("[news] briefings GET failed", error);
    return jsonError(500, "Could not load briefings");
  }
}
