import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BriefingStory from "@/models/BriefingStory";
import NewsPreference from "@/models/NewsPreference";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { getOrCreatePreferences } from "@/lib/news/preferences";
import { askAboutStory, AskError } from "@/lib/news/ask";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Answering costs an OpenAI call plus MCP searches, so one question at a time
// per user. The claim is a conditional update, which makes it atomic across
// concurrent requests.
const ASK_COOLDOWN_MS = 4000;
const ASK_BUDGET_MS = 100000;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

async function claimAskSlot(userId) {
  const cutoff = new Date(Date.now() - ASK_COOLDOWN_MS);
  const claimed = await NewsPreference.findOneAndUpdate(
    {
      user: userId,
      $or: [{ lastAskAt: { $lte: cutoff } }, { lastAskAt: null }, { lastAskAt: { $exists: false } }],
    },
    { $set: { lastAskAt: new Date() } },
  );
  return Boolean(claimed);
}

// POST /api/news/stories/ask  { storyId, question }
// Answers from the story's sources, running extra MCP searches when the
// question needs context the sources do not contain.
export async function POST(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(
    req,
    z.object({ storyId: objectId, question: z.string().trim().min(2).max(500) }),
  );
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    await getOrCreatePreferences(auth.userId);
    if (!(await claimAskSlot(auth.userId))) {
      return Response.json(
        { error: "One question at a time, please. Try again in a moment.", code: "too_many_requests" },
        { status: 429 },
      );
    }

    const story = await BriefingStory.findOne({ _id: body.data.storyId, user: auth.userId }).lean();
    if (!story) return jsonError(404, "Story not found");

    const result = await askAboutStory({
      story,
      question: body.data.question,
      budgetMs: ASK_BUDGET_MS,
      log: (m) => console.log(`[news] ask: ${m}`),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AskError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[news] ask failed", error);
    return jsonError(500, "Could not answer the question");
  }
}
