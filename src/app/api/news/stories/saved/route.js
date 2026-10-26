import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BriefingStory from "@/models/BriefingStory";
import SavedStory from "@/models/SavedStory";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { savedStoryDto } from "@/lib/news/serialize";
import { hubStory } from "@/lib/newsHub/client";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// GET /api/news/stories/saved
export async function GET(req) {
  const auth = await requireUser(req);
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

/** Save a news hub story: its text and sources come from the hub, not the browser. */
async function saveHubStory(userId, storyId) {
  const res = await hubStory(storyId);
  if (!res.ok || !res.story) return jsonError(404, "Story not found");
  const s = res.story;
  const saved = await SavedStory.findOneAndUpdate(
    { user: userId, story: s.id },
    {
      $setOnInsert: {
        hub: true,
        headline: s.headline,
        summary: s.summary,
        whyItMatters: s.whyItMatters || "",
        url: s.sources?.[0]?.url || "",
        publisher: s.sources?.[0]?.publisher || "",
        publishedAt: s.sources?.[0]?.publishedAt || null,
        topics: [s.topic],
        language: s.language || "",
        countries: s.countries || [],
        sources: (s.sources || []).slice(0, 10).map((x) => ({ title: x.title, url: x.url, publisher: x.publisher })),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return Response.json({ saved: savedStoryDto(saved) }, { status: 201 });
}

// POST /api/news/stories/saved  { storyId, hub? }
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ storyId: objectId, hub: z.boolean().optional() }));
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    if (body.data.hub) return await saveHubStory(auth.userId, body.data.storyId);
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
  const auth = await requireUser(req);
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
