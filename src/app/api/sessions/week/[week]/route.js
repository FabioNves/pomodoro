import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";

export async function GET(request, { params }) {
  try {
    const { week } = await params;
    const weekNumber = parseInt(week, 10);
    const now = new Date();
    const year = now.getFullYear();

    // Get user ID from headers
    const userId = request.headers.get("user-id");

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

    const query = {
      date: { $gte: startOfWeek, $lte: endOfWeek },
    };

    if (userId) {
      query.user = userId;
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
