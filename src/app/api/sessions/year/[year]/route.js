import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";

export async function GET(request, { params }) {
  try {
    const { year } = await params;
    const yearNumber = parseInt(year, 10);

    // Get user ID from headers
    const userId = request.headers.get("user-id");

    // Create start and end dates for the year
    const startOfYear = new Date(yearNumber, 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const endOfYear = new Date(yearNumber, 11, 31);
    endOfYear.setHours(23, 59, 59, 999);

    await connectToDB();

    // Filter by user and date range
    const query = {
      date: { $gte: startOfYear, $lte: endOfYear },
    };

    // Add user filter if userId exists
    if (userId) {
      query.user = userId;
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
