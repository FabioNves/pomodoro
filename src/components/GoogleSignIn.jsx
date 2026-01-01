"use client";
import React from "react";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const GoogleSignIn = ({ onLoginSuccess }) => {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // Decode the Google JWT token
      const decodedToken = jwtDecode(credentialResponse.credential);

      // Create user data object
      const userData = {
        userId: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
      };

      // Store the token in localStorage (userId will be set by GoogleAuth backend flow)
      localStorage.setItem("accessToken", credentialResponse.credential);
      // DON'T set userId here - it should come from the backend auth flow

      // Call the success handler
      onLoginSuccess(userData);
    } catch (error) {
      console.error("Error handling Google login:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

  return (
    <motion.div
      className="flex flex-col items-center space-y-6 p-8 bg-gray-800/50 rounded-xl backdrop-blur-sm border border-gray-700/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to PomoDRIVE</h2>
        <p className="text-gray-400">
          Sign in to track your productivity sessions
        </p>
      </div>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          size="large"
          text="signin_with"
          shape="rectangular"
          theme="filled_blue"
        />
      </motion.div>

      <div className="text-center text-sm text-gray-500">
        <p>Your data is secure and private</p>
      </div>
    </motion.div>
  );
};

export default GoogleSignIn;
