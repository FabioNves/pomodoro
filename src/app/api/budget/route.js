import { z } from "zod";
import { connectToDB } from "@/lib/db";
import { requireUser } from "@/lib/sessionAuth";
import { validateSearchParams } from "@/utils/apiValidation";
import { monthsOfYear } from "@/lib/budget/engine";
import { SIGN_IN, monthKey, run, ensureSettings, settingsDto, entriesFor, seriesFor } from "@/lib/budget/server";

// GET /api/budget?month=YYYY-MM | ?year=YYYY
// The budget's settings and the entries the screen draws: for a month, the
// ones that belong to it or are paid in it (delayed ones from earlier
// months included); for a year, every entry of its twelve months. Repeating
// entries get their occurrences for those months first; `series` holds the
// rules of the repeating ones on screen.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(
    req,
    z
      .object({ month: monthKey.optional(), year: z.string().regex(/^\d{4}$/).optional() })
      .refine((q) => q.month || q.year, "Give a month or a year"),
  );
  if (!query.ok) return query.response;

  return run("GET budget", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const months = query.data.month ? [query.data.month] : monthsOfYear(query.data.year);
    const entries = await entriesFor(auth.userId, months);
    const series = await seriesFor(auth.userId, entries);
    return Response.json({ settings: settingsDto(settings), entries, series });
  });
}
