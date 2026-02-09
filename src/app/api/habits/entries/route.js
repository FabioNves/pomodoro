import { connectToDB } from "@/lib/db";
import HabitEntry from "@/models/HabitEntry";
import { z } from "zod";
import {
  getIdentityHeaders,
  validateIdentityHeaders,
  validateJsonBody,
  validateSearchParams,
} from "@/utils/apiValidation";

function identityQuery({ userId, sessionId }) {
  if (userId) return { user: userId };
  if (sessionId) return { sessionId };
  return null;
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const getEntriesSchema = z.object({
  habitId: objectIdSchema.optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

const upsertEntrySchema = z.object({
  habitId: objectIdSchema,
  date: dateSchema,
  level: z.number().int().min(0).max(10),
});

// GET /api/habits/entries?habitId=...&year=...
export async function GET(req) {
  try {
    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    const queryValidation = validateSearchParams(req, getEntriesSchema);
    if (!queryValidation.ok) return queryValidation.response;

    const { habitId, year } = queryValidation.data;

    await connectToDB();

    const query = {
      ...identityQuery(ident.data),
      ...(habitId ? { habit: habitId } : {}),
    };

    if (year) {
      query.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }

    const entries = await HabitEntry.find(query).sort({ date: 1 });
    return Response.json(entries);
  } catch (error) {
    console.error("Error fetching habit entries:", error);
    return Response.json(
      { error: "Error fetching habit entries" },
      { status: 500 },
    );
  }
}

// PUT /api/habits/entries  (upsert)
export async function PUT(req) {
  try {
    const body = await validateJsonBody(req, upsertEntrySchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const identity = getIdentityHeaders(req);
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const { habitId, date, level } = body.data;

    if (level === 0) {
      // Remove entry if level is 0 (none)
      await HabitEntry.findOneAndDelete({
        habit: habitId,
        date,
        ...identQuery,
      });
      return Response.json({ ok: true, deleted: true });
    }

    const entry = await HabitEntry.findOneAndUpdate(
      { habit: habitId, date, ...identQuery },
      {
        $set: { level },
        $setOnInsert: {
          habit: habitId,
          date,
          ...(identity.userId
            ? { user: identity.userId, isTemporary: false }
            : { sessionId: identity.sessionId, isTemporary: true }),
        },
      },
      { new: true, upsert: true },
    );

    return Response.json(entry);
  } catch (error) {
    console.error("Error upserting habit entry:", error);
    return Response.json(
      { error: "Error upserting habit entry" },
      { status: 500 },
    );
  }
}
