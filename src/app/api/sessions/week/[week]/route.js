import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";
import User from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";
import { validateRouteParams } from "@/utils/apiValidation";

const weekParamsSchema = z.object({
  week: z.coerce.number().int().min(1).max(53),
});

const optionalUserIdSchema = z.string().trim().min(1).max(256).optional();

export async function GET(request, { params }) {
  try {
    const paramsValidation = validateRouteParams(params, weekParamsSchema);
    if (!paramsValidation.ok) return paramsValidation.response;

    const weekNumber = paramsValidation.data.week;
    const now = new Date();
    const year = now.getFullYear();

    // Get user ID from headers
    const userIdRaw = request.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    const firstDayOfYear = new Date(year, 0, 1);
    const firstDayOfWeek = firstDayOfYear.getDay();

    let firstMonday =
      firstDayOfWeek === 1
        ? firstDayOfYear
        : new Date(
            year,
            0,
            1 + (firstDayOfWeek === 0 ? 1 : 8 - firstDayOfWeek)
          );

    const startOfWeek = new Date(firstMonday);
    startOfWeek.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    await connectToDB();

    let userIds = [];
    if (userId) {
      userIds = [userId];

      // If we received a Mongo ObjectId, include the user's googleSub as a legacy ID.
      if (mongoose.Types.ObjectId.isValid(userId)) {
        const dbUser = await User.findById(userId).select("googleSub");
        if (dbUser?.googleSub && dbUser.googleSub !== userId) {
          userIds.push(dbUser.googleSub);
        }
      }
    }

    const query = {
      date: { $gte: startOfWeek, $lte: endOfWeek },
    };

    if (userIds.length === 1) {
      query.user = userIds[0];
    } else if (userIds.length > 1) {
      query.user = { $in: userIds };
    }

    const sessions = await Session.find(query);

    console.log(
      `Found ${sessions.length} sessions for week ${weekNumber} for user ${userId}`
    );

    return Response.json({ sessions, startOfWeek });
  } catch (error) {
    console.error("Error fetching week sessions:", error);
    return Response.json({ error: "Error fetching sessions" }, { status: 500 });
  }
}
