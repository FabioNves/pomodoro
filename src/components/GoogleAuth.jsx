"use client";
import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const GoogleAuth = ({ onLogin }) => {
  const [user, setUser] = useState(null);

  const login = useGoogleLogin({
    scope:
      "https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",

    onSuccess: async (tokenResponse) => {
      try {
        const { access_token, refresh_token, expires_in } = tokenResponse;
        if (!access_token)
          throw new Error("Missing access token in token response");

        // Send Google token to your backend to get your own JWT and user info
        const backendResponse = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
          }),
        });

        if (!backendResponse.ok)
          throw new Error("Failed to authenticate with backend");

        const { token, user: backendUser } = await backendResponse.json();

        console.log("=== GoogleAuth LOGIN: Setting localStorage ===");
        console.log("Backend user:", backendUser);
        console.log(
          "Setting userId to:",
          backendUser.userId || backendUser._id
        );

        // Store your own JWT and user info
        localStorage.setItem("accessToken", token);
        setUser(jwtDecode(token));
        localStorage.setItem("userId", backendUser.userId || backendUser._id);
        localStorage.setItem("userName", backendUser.name);

        console.log("localStorage after setting:");
        console.log("- userId:", localStorage.getItem("userId"));
        console.log("- userName:", localStorage.getItem("userName"));

        if (onLogin) onLogin(backendUser);
      } catch (error) {
        console.error("Error processing login:", error);
      }
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });

  // Create a separate login specifically for re-granting permissions
  const reauthorize = useGoogleLogin({
    scope:
      "https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    onSuccess: async (tokenResponse) => {
      try {
        const { access_token, refresh_token, expires_in } = tokenResponse;
        if (!access_token)
          throw new Error("Missing access token in token response");

        // Send Google token to your backend
        const backendResponse = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
          }),
        });

        if (!backendResponse.ok)
          throw new Error("Failed to authenticate with backend");

        const { token, user: backendUser } = await backendResponse.json();

        console.log("=== GoogleAuth REAUTH: Setting localStorage ===");
        console.log("Backend user:", backendUser);
        console.log(
          "Setting userId to:",
          backendUser.userId || backendUser._id
        );

        // Store your own JWT and user info
        localStorage.setItem("accessToken", token);
        setUser(jwtDecode(token));
        localStorage.setItem("userId", backendUser.userId || backendUser._id);
        localStorage.setItem("userName", backendUser.name);

        console.log("localStorage after setting:");
        console.log("- userId:", localStorage.getItem("userId"));
        console.log("- userName:", localStorage.getItem("userName"));

        if (onLogin) onLogin(backendUser);

        // Refresh the page to reload Google Tasks
        window.location.reload();
      } catch (error) {
        console.error("Error processing reauthorization:", error);
      }
    },
    onError: (error) => {
      console.error("Reauthorization failed:", error);
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
        <div className="flex gap-2 items-center">
          <p>Welcome, {user.name}</p>
          <button
            className="bg-green-500 text-white px-3 py-1.5 text-sm rounded hover:bg-green-600"
            onClick={() => reauthorize()}
            title="Reconnect to grant Google Tasks access"
          >
            Grant Tasks Access
          </button>
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
