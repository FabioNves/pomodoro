import { connectToDB } from "@/lib/db";
import Brand from "@/models/Brand";
import { getUserFromRequest } from "@/utils/getUserFromRequest";

// POST /api/brands
export async function POST(req) {
  try {
    const userId = req.headers.get("user-id"); // <-- Use user-id header
    const { name, sessionId } = await req.json();

    await connectToDB();

    const newBrand = new Brand({
      name,
      user: userId || null, // Use userId if logged in
      sessionId: userId ? null : sessionId, // Use sessionId if not logged in
      isTemporary: !userId, // Mark as temporary if not logged in
    });

    await newBrand.save();

    return new Response(
      JSON.stringify({ message: "Brand saved successfully", brand: newBrand }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving brand:", error);
    return new Response(JSON.stringify({ error: "Error saving brand" }), {
      status: 500,
    });
  }
}

// GET /api/brands
export async function GET(req) {
  try {
    const userId = req.headers.get("user-id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    await connectToDB();
    const brands = await Brand.find({ user: userId });
    return new Response(JSON.stringify(brands), { status: 200 });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return new Response(JSON.stringify({ error: "Error fetching brands" }), {
      status: 500,
    });
  }
}

// Fetch brands function
const fetchBrands = async () => {
  const user = getUserFromRequest(req); // Assuming you have a way to get the user from the request
  if (!user) {
    throw new Error("User is not logged in");
  }

  const response = await fetch("/api/brands", {
    method: "GET",
    headers: {
      "user-id": user.userId, // Pass user ID in headers
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch brands");
  }

  return response.json();
};
