import { connectToDB } from "@/lib/db";
import SavedStory from "@/models/SavedStory";
import { jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { getOrCreatePreferences } from "@/lib/news/preferences";
import { hubNewsConfigured } from "@/lib/newsHub/client";
import { loadHubStories, listHubTopics } from "@/lib/news/hubStories";

export const dynamic = "force-dynamic";

const KEY_RE = /^(latest|\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/;

// GET /api/news/hub?period=daily|weekly&key=latest
// The news hub's stories for each of the reader's editions (language and
// regions), kept to the hub topics they follow, with which ones they saved.
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!hubNewsConfigured()) return Response.json({ configured: false, editions: [], topics: [] });
  const params = new URL(req.url).searchParams;
  const period = params.get("period") === "weekly" ? "weekly" : "daily";
  const key = KEY_RE.test(params.get("key") || "") ? params.get("key") : "latest";
  try {
    await connectToDB();
    const pref = await getOrCreatePreferences(auth.userId);
    const [{ editions, error }, topics] = await Promise.all([loadHubStories(pref, { period, key }), listHubTopics()]);
    const ids = editions.flatMap((e) => e.digests.flatMap((d) => d.stories.map((s) => s.id)));
    const saved = ids.length
      ? await SavedStory.find({ user: auth.userId, story: { $in: ids } }).select("story").lean()
      : [];
    return Response.json({
      configured: true,
      period,
      editions,
      topics,
      followed: [...(pref.hubTopics || [])],
      language: pref.language || "en",
      saved: saved.map((s) => String(s.story)),
      error,
    });
  } catch (error) {
    console.error("[news] hub stories failed", error);
    return jsonError(500, "Could not load the stories");
  }
}
