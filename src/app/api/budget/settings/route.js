import { z } from "zod";
import { connectToDB } from "@/lib/db";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { SIGN_IN, currency, run, ensureSettings, settingsDto } from "@/lib/budget/server";

// PATCH /api/budget/settings  { currency }
// Only the symbol changes: amounts are never converted.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ currency }));
  if (!body.ok) return body.response;

  return run("PATCH budget settings", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    settings.currency = body.data.currency;
    await settings.save();
    return Response.json({ settings: settingsDto(settings) });
  });
}
