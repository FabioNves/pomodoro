"use client";
import React, { useState } from "react";
import SignInButton from "@/components/auth/SignInButton";
import { clearSession } from "@/lib/auth";

const GoogleAuth = ({ onLogin }) => {
  const [user, setUser] = useState(null);

  const handleSignedIn = (backendUser) => {
    setUser(backendUser);
    if (onLogin) onLogin(backendUser);
  };

  const handleSignOut = () => {
    clearSession();
    setUser(null);
    if (onLogin) onLogin(null);
  };

  return (
    <div className="google-auth">
      {user ? (
        <div className="flex gap-2 items-center">
          <p>Welcome, {user.name}</p>
          <button
            className="bg-danger text-white px-4 py-2 rounded hover:bg-danger-hover"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <SignInButton onSuccess={handleSignedIn} />
      )}
    </div>
  );
};

export default GoogleAuth;
