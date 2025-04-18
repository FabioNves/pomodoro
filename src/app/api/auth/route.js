import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, "ACCESS_SECRET", {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign({ userId }, "REFRESH_SECRET", {
    expiresIn: "3d",
  });
  return { accessToken, refreshToken };
};

export async function POST(req) {
  try {
    const { userId } = await req.json(); // Validate user credentials first
    const tokens = generateTokens(userId);

    const response = new Response(
      JSON.stringify({ accessToken: tokens.accessToken }),
      { status: 200 }
    );

    response.headers.set(
      "Set-Cookie",
      `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; Max-Age=${
        3 * 24 * 60 * 60
      }`
    );

    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error logging in" }), {
      status: 500,
    });
  }
}

export async function PUT(req) {
  const refreshToken = cookies().get("refreshToken")?.value;

  try {
    const payload = jwt.verify(refreshToken, "REFRESH_SECRET");
    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      "ACCESS_SECRET",
      { expiresIn: "1h" }
    );
    return new Response(JSON.stringify({ accessToken: newAccessToken }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
      status: 401,
    });
  }
}

export const refreshAccessToken = async () => {
  try {
    const response = await fetch("/api/auth", {
      method: "PUT",
      credentials: "include",
    });
    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem("accessToken", accessToken); // Store the new access token
      return accessToken;
    } else {
      throw new Error("Failed to refresh access token");
    }
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return null;
  }
};

export const loginUser = async (userId) => {
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem("accessToken", accessToken); // Store the access token
      return accessToken;
    } else {
      throw new Error("Failed to log in");
    }
  } catch (error) {
    console.error("Error logging in:", error);
    return null;
  }
};

export const loginWithGoogle = async (response) => {
  try {
    const googleToken = response.credential; // from Google
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleToken }),
    });
    const { token, user } = await res.json();
    localStorage.setItem("accessToken", token);
    localStorage.setItem("userId", user._id);
    localStorage.setItem("userName", user.name);
  } catch (error) {
    console.error("Error logging in with Google:", error);
  }
};
