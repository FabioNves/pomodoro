import { z } from "zod";
import { connectToDB } from "@/lib/db";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { isKnownLanguage } from "@/lib/news/locales";
import { hubStory } from "@/lib/newsHub/client";
import { translateHubStory } from "@/lib/news/hubStories";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST /api/news/hub/translate { storyId, language }
// A hub story in the reader's language. The text comes from the hub, not
// the browser; the translation is made once per story and language.
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      storyId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
      language: z.string().trim().toLowerCase().refine(isKnownLanguage, "Unknown language"),
    }),
  );
  if (!body.ok) return body.response;
  try {
    const res = await hubStory(body.data.storyId);
    if (!res.ok || !res.story) return jsonError(404, "Story not found");
    await connectToDB();
    const t = await translateHubStory(res.story, body.data.language);
    return Response.json({ headline: t.headline, summary: t.summary, whyItMatters: t.whyItMatters });
  } catch (error) {
    console.error("[news] hub translate failed", error);
    return jsonError(502, "Could not translate the story right now");
  }
}
