"use client";
import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const GoogleAuth = ({ onLogin }) => {
  const [user, setUser] = useState(null);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const { access_token } = tokenResponse;
        if (!access_token)
          throw new Error("Missing access token in token response");

        // Send Google token to your backend to get your own JWT and user info
        const backendResponse = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleToken: access_token }),
        });

        if (!backendResponse.ok)
          throw new Error("Failed to authenticate with backend");

        const { token, user: backendUser } = await backendResponse.json();

        // Store your own JWT and user info
        localStorage.setItem("accessToken", token);
        setUser(jwtDecode(token));
        localStorage.setItem("userId", backendUser.userId || backendUser._id);
        localStorage.setItem("userName", backendUser.name);

        if (onLogin) onLogin(backendUser);
      } catch (error) {
        console.error("Error processing login:", error);
      }
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });

  const handleSignOut = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    if (onLogin) onLogin(null);
  };

  return (
    <div className="google-auth">
      {user ? (
        <div>
          <p>Welcome, {user.name}</p>
          <button
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => login()}
        >
          Sign In with Google
        </button>
      )}
    </div>
  );
};

export default GoogleAuth;
