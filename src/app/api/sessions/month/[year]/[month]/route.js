import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";

export async function GET(request, { params }) {
  try {
    const { year, month } = await params;
    const yearNumber = parseInt(year, 10);
    const monthNumber = parseInt(month, 10);

    // Get user ID from headers (same pattern as your other API routes)
    const userId = request.headers.get("user-id");

    // Create start and end dates for the month
    const startOfMonth = new Date(yearNumber, monthNumber - 1, 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(yearNumber, monthNumber, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    await connectToDB();

    // Filter by user and date range
    const query = {
      date: { $gte: startOfMonth, $lte: endOfMonth },
    };

    // Add user filter if userId exists
    if (userId) {
      query.user = userId;
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
