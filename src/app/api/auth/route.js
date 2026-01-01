import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

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
    const { userId } = await req.json(); // Validate user credentials first
    console.log("[auth/POST] Generating tokens for userId:", userId);
    console.log("[auth/POST] JWT_SECRET exists:", !!process.env.JWT_SECRET);
    const tokens = generateTokens(userId);
    console.log(
      "[auth/POST] Generated accessToken:",
      tokens.accessToken ? `${tokens.accessToken.substring(0, 50)}...` : "null"
    );

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
  console.log("[auth/PUT] Refresh token exists:", !!refreshToken);
  console.log(
    "[auth/PUT] Refresh token preview:",
    refreshToken ? `${refreshToken.substring(0, 50)}...` : "missing"
  );

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "REFRESH_SECRET"
    );
    console.log("[auth/PUT] Refresh token verified. UserId:", payload.userId);

    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log(
      "[auth/PUT] New access token generated:",
      `${newAccessToken.substring(0, 50)}...`
    );

    return new Response(JSON.stringify({ accessToken: newAccessToken }), {
      status: 200,
    });
  } catch (error) {
    console.error("[auth/PUT] Error verifying refresh token:", error.message);
    console.error("[auth/PUT] Error details:", error);
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
