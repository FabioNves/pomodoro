import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || "REFRESH_SECRET",
    {
      expiresIn: "3d",
    }
  );
  return { accessToken, refreshToken };
};

export async function POST(req) {
  try {
    const body = await validateJsonBody(
      req,
      z.object({ userId: z.string().trim().min(1).max(256) })
    );
    if (!body.ok) return body.response;

    const { userId } = body.data; // Validate user credentials first
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

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "Missing refresh token" }), {
      status: 401,
    });
  }

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "REFRESH_SECRET"
    );
    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_SECRET,
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
