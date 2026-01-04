import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";
import User from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";
import { validateRouteParams } from "@/utils/apiValidation";

const yearParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

const optionalUserIdSchema = z.string().trim().min(1).max(256).optional();

export async function GET(request, { params }) {
  try {
    const paramsValidation = validateRouteParams(params, yearParamsSchema);
    if (!paramsValidation.ok) return paramsValidation.response;

    const yearNumber = paramsValidation.data.year;

    // Get user ID from headers
    const userIdRaw = request.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    // Create start and end dates for the year
    const startOfYear = new Date(yearNumber, 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const endOfYear = new Date(yearNumber, 11, 31);
    endOfYear.setHours(23, 59, 59, 999);

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
      date: { $gte: startOfYear, $lte: endOfYear },
    };

    // Add user filter if userId exists
    if (userIds.length === 1) {
      query.user = userIds[0];
    } else if (userIds.length > 1) {
      query.user = { $in: userIds };
    }

    const sessions = await Session.find(query);

    console.log(
      `Found ${sessions.length} sessions for ${yearNumber} for user ${userId}`
    );

    return Response.json(sessions);
  } catch (error) {
    console.error("Error fetching year sessions:", error);
    return Response.json({ error: "Error fetching sessions" }, { status: 500 });
  }
}
