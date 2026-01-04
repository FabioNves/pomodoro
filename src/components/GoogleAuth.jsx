"use client";
import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const GoogleAuth = ({ onLogin }) => {
  const [user, setUser] = useState(null);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const backendResponse = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleToken: credentialResponse.credential,
        }),
      });

      if (!backendResponse.ok) throw new Error("Failed to authenticate");

      const { token, user: backendUser } = await backendResponse.json();

      localStorage.setItem("accessToken", token);
      setUser(jwtDecode(token));
      localStorage.setItem("userId", backendUser.userId || backendUser._id);
      localStorage.setItem("userName", backendUser.name);

      if (onLogin) onLogin(backendUser);
    } catch (error) {
      console.error("Error processing login:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

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
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          size="large"
          text="signin_with"
          shape="rectangular"
          theme="filled_blue"
        />
      )}
    </div>
  );
};

export default GoogleAuth;
