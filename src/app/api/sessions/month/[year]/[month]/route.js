import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";
import User from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";
import { validateRouteParams } from "@/utils/apiValidation";

const monthParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const optionalUserIdSchema = z.string().trim().min(1).max(256).optional();

export async function GET(request, { params }) {
  try {
    const paramsValidation = validateRouteParams(params, monthParamsSchema);
    if (!paramsValidation.ok) return paramsValidation.response;

    const yearNumber = paramsValidation.data.year;
    const monthNumber = paramsValidation.data.month;

    // Get user ID from headers (same pattern as your other API routes)
    const userIdRaw = request.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    // Create start and end dates for the month
    const startOfMonth = new Date(yearNumber, monthNumber - 1, 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(yearNumber, monthNumber, 0);
    endOfMonth.setHours(23, 59, 59, 999);

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

    // Filter by user and date range
    const query = {
      date: { $gte: startOfMonth, $lte: endOfMonth },
    };

    // Add user filter if userId exists
    if (userIds.length === 1) {
      query.user = userIds[0];
    } else if (userIds.length > 1) {
      query.user = { $in: userIds };
    }

    const sessions = await Session.find(query);

    console.log(
      `Found ${sessions.length} sessions for ${yearNumber}/${monthNumber} for user ${userId}`
    );

    return Response.json(sessions);
  } catch (error) {
    console.error("Error fetching month sessions:", error);
    return Response.json({ error: "Error fetching sessions" }, { status: 500 });
  }
}
