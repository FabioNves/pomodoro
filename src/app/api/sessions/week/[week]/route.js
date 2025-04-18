import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";

export async function GET(_, { params }) {
  try {
    const weekNumber = parseInt(params.week, 10);
    const now = new Date();
    const year = now.getFullYear();

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

    const sessions = await Session.find({
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    return Response.json({ sessions, startOfWeek });
  } catch (error) {
    return Response.json({ error: "Error fetching sessions" }, { status: 500 });
  }
}
