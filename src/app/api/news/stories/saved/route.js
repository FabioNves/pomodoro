import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BriefingStory from "@/models/BriefingStory";
import SavedStory from "@/models/SavedStory";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { savedStoryDto } from "@/lib/news/serialize";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// GET /api/news/stories/saved
export async function GET(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await connectToDB();
    const saved = await SavedStory.find({ user: auth.userId }).sort({ createdAt: -1 }).limit(200).lean();
    return Response.json({ saved: saved.map(savedStoryDto) });
  } catch (error) {
    console.error("[news] saved GET failed", error);
    return jsonError(500, "Could not load saved stories");
  }
}

// POST /api/news/stories/saved  { storyId }
export async function POST(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ storyId: objectId }));
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const story = await BriefingStory.findOne({ _id: body.data.storyId, user: auth.userId }).lean();
    if (!story) return jsonError(404, "Story not found");
    const saved = await SavedStory.findOneAndUpdate(
      { user: auth.userId, story: story._id },
      {
        $setOnInsert: {
          briefing: story.briefing,
          headline: story.headline,
          summary: story.summary,
          url: story.url,
          publisher: story.publisher,
          publishedAt: story.publishedAt,
          topics: story.topics || [],
          language: story.language || "",
          outputLanguage: story.outputLanguage || "",
          countries: story.countries || [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return Response.json({ saved: savedStoryDto(saved) }, { status: 201 });
  } catch (error) {
    console.error("[news] save story failed", error);
    return jsonError(500, "Could not save the story");
  }
}

// DELETE /api/news/stories/saved  { storyId }
export async function DELETE(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ storyId: objectId }));
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    await SavedStory.deleteOne({ user: auth.userId, story: body.data.storyId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[news] unsave story failed", error);
    return jsonError(500, "Could not remove the saved story");
  }
}
