import { z } from "zod";
import { connectToDB } from "@/lib/db";
import { validateJsonBody, validateSearchParams, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import {
  getOrCreatePreferences,
  applyPreferenceUpdate,
  preferencesDto,
  preferencesUpdateSchema,
  SUGGESTED_TOPICS,
} from "@/lib/news/preferences";
import { nextDelivery } from "@/lib/news/schedule";

// GET /api/news/preferences?tz=Europe/Lisbon
// Returns (and on first use creates) the user's briefing preferences. The
// optional tz hint seeds the timezone from the browser the first time.
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const params = validateSearchParams(req, z.object({ tz: z.string().max(64).optional() }));
  if (!params.ok) return params.response;

  try {
    await connectToDB();
    const { pref, created } = await getOrCreatePreferences(auth.userId, { timezoneHint: params.data.tz });
    return Response.json({
      preferences: preferencesDto(pref),
      created,
      suggestedTopics: SUGGESTED_TOPICS,
      nextDelivery: nextDelivery(pref),
    });
  } catch (error) {
    console.error("[news] preferences GET failed", error);
    return jsonError(500, "Could not load news preferences");
  }
}

// PUT /api/news/preferences  { timezone?, daily?, weekly?, custom?, ... }
export async function PUT(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await validateJsonBody(req, preferencesUpdateSchema);
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const { pref } = await getOrCreatePreferences(auth.userId);
    applyPreferenceUpdate(pref, body.data);
    await pref.save();
    return Response.json({ preferences: preferencesDto(pref), nextDelivery: nextDelivery(pref) });
  } catch (error) {
    console.error("[news] preferences PUT failed", error);
    return jsonError(500, "Could not save news preferences");
  }
}
