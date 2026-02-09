import { connectToDB } from "@/lib/db";
import Habit from "@/models/Habit";
import HabitEntry from "@/models/HabitEntry";
import { z } from "zod";
import {
  getIdentityHeaders,
  validateIdentityHeaders,
  validateJsonBody,
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

const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(20).optional(),
  levels: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        value: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(10),
});

const patchHabitSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().trim().min(1).max(20).optional(),
  levels: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        value: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
});

const deleteHabitSchema = z.object({
  id: objectIdSchema,
});

// GET /api/habits
export async function GET(req) {
  try {
    const ident = validateIdentityHeaders(req);
    if (!ident.ok) return ident.response;

    await connectToDB();

    const habits = await Habit.find(identityQuery(ident.data)).sort({
      order: 1,
      createdAt: 1,
    });
    return Response.json(habits);
  } catch (error) {
    console.error("Error fetching habits:", error);
    return Response.json({ error: "Error fetching habits" }, { status: 500 });
  }
}

// POST /api/habits
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, createHabitSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;

    const identity = getIdentityHeaders(req);
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const maxOrder = await Habit.find(identQuery)
      .sort({ order: -1 })
      .limit(1)
      .select({ order: 1 });

    const nextOrder = (maxOrder?.[0]?.order ?? -1) + 1 || 0;

    const habit = await Habit.create({
      name: body.data.name,
      color: body.data.color || "blue",
      levels: body.data.levels,
      order: nextOrder,
      ...(identity.userId
        ? { user: identity.userId, isTemporary: false }
        : { sessionId: identity.sessionId, isTemporary: true }),
    });

    return Response.json(habit, { status: 201 });
  } catch (error) {
    console.error("Error creating habit:", error);
    return Response.json({ error: "Error creating habit" }, { status: 500 });
  }
}

// PATCH /api/habits
export async function PATCH(req) {
  try {
    const body = await validateJsonBody(req, patchHabitSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const { id, ...updates } = body.data;
    const setObj = {};
    if (updates.name) setObj.name = updates.name;
    if (updates.color) setObj.color = updates.color;
    if (updates.levels) setObj.levels = updates.levels;

    if (!Object.keys(setObj).length) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await Habit.findOneAndUpdate(
      { _id: id, ...identQuery },
      { $set: setObj },
      { new: true },
    );

    if (!updated) {
      return Response.json({ error: "Habit not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating habit:", error);
    return Response.json({ error: "Error updating habit" }, { status: 500 });
  }
}

// DELETE /api/habits
export async function DELETE(req) {
  try {
    const body = await validateJsonBody(req, deleteHabitSchema);
    if (!body.ok) return body.response;

    const identityValidation = validateIdentityHeaders(req);
    if (!identityValidation.ok) return identityValidation.response;
    const identQuery = identityQuery(identityValidation.data);

    await connectToDB();

    const habit = await Habit.findOneAndDelete({
      _id: body.data.id,
      ...identQuery,
    });
    if (!habit) {
      return Response.json({ error: "Habit not found" }, { status: 404 });
    }

    // Also delete all entries for this habit
    await HabitEntry.deleteMany({ habit: body.data.id, ...identQuery });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting habit:", error);
    return Response.json({ error: "Error deleting habit" }, { status: 500 });
  }
}
