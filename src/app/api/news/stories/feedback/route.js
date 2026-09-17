import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BriefingStory from "@/models/BriefingStory";
import NewsFeedback, { FEEDBACK_VALUES } from "@/models/NewsFeedback";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// POST /api/news/stories/feedback  { storyId, value: relevant | not_relevant |
//   interesting | not_interested | null }   (null clears the verdict)
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(
    req,
    z.object({ storyId: objectId, value: z.enum(FEEDBACK_VALUES).nullable() }),
  );
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const story = await BriefingStory.findOne({ _id: body.data.storyId, user: auth.userId }).lean();
    if (!story) return jsonError(404, "Story not found");

    if (body.data.value === null) {
      await NewsFeedback.deleteOne({ user: auth.userId, story: story._id });
      return Response.json({ ok: true, feedback: null });
    }

    let domain = "";
    try {
      domain = new URL(story.url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    await NewsFeedback.findOneAndUpdate(
      { user: auth.userId, story: story._id },
      {
        $set: {
          value: body.data.value,
          briefing: story.briefing,
          headline: story.headline,
          topics: story.topics || [],
          domain,
          url: story.url,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return Response.json({ ok: true, feedback: body.data.value });
  } catch (error) {
    console.error("[news] feedback failed", error);
    return jsonError(500, "Could not save feedback");
  }
}
