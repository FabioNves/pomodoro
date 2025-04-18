import { connectToDB } from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { name, email, imageUrl } = await req.json();

    await connectToDB(); // Ensure DB connection

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email, imageUrl });
      await user.save();
    }

    // Return the database `_id` along with other user details
    return new Response(
      JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Error saving user:", err);
    return new Response(JSON.stringify({ error: "Failed to save user" }), {
      status: 500,
    });
  }
}
