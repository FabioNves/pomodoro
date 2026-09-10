"use client";
import React from "react";
import { motion } from "framer-motion";
import SignInButton from "@/components/auth/SignInButton";

const GoogleSignIn = ({ onLoginSuccess }) => {
  // SignInButton has stored the session; hand the page the user it expects.
  const handleSignedIn = (backendUser) => {
    onLoginSuccess({
      userId: backendUser.userId || backendUser._id,
      email: backendUser.email,
      name: backendUser.name,
      picture: backendUser.imageUrl,
    });
  };

  return (
    <motion.div
      className="flex flex-col items-center space-y-6 p-8 bg-surface/80 rounded-xl backdrop-blur-sm border border-edge"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to PomoDRIVE</h2>
        <p className="text-fg-muted">
          Sign in to track your productivity sessions
        </p>
      </div>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <SignInButton onSuccess={handleSignedIn} />
      </motion.div>

      <div className="text-center text-sm text-fg-subtle">
        <p>Your data is secure and private</p>
      </div>
    </motion.div>
  );
};

export default GoogleSignIn;
