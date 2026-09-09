"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import PublicTimerControls from "../components/PublicTimer1/PublicTimerControls";
import {
  requestNotificationPermission,
  showNotification,
} from "../utils/notifications";

export default function App() {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
    requestNotificationPermission();

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
        } catch (error) {
          console.error("Error decoding token:", error);
          localStorage.removeItem("accessToken");
        }
      } else {
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  // Signed-in users land on the dashboard.
  useEffect(() => {
    if (hasMounted && user) router.replace("/dashboard");
  }, [hasMounted, user, router]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decodedToken = jwtDecode(credentialResponse.credential);

      console.log("=== PAGE.JS: Google login started ===");
      console.log("Email:", decodedToken.email);

      // Send the Google credential to backend to exchange for our own JWT
      const backendResponse = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleToken: credentialResponse.credential,
          // Note: credential flow doesn't provide refresh_token
        }),
      });

      if (!backendResponse.ok) {
        throw new Error("Backend authentication failed");
      }

      const { token, user: backendUser } = await backendResponse.json();

      console.log("=== PAGE.JS: Setting localStorage ===");
      console.log("Backend user:", backendUser);
      console.log("Setting userId to:", backendUser.userId || backendUser._id);

      // Store our backend JWT and user info
      localStorage.setItem("accessToken", token);
      localStorage.setItem("userId", backendUser.userId || backendUser._id);
      localStorage.setItem("userName", backendUser.name);

      console.log("localStorage after setting:");
      console.log("- userId:", localStorage.getItem("userId"));
      console.log("- userName:", localStorage.getItem("userName"));

      setUser({
        userId: backendUser.userId || backendUser._id,
        email: backendUser.email,
        name: backendUser.name,
        picture: backendUser.imageUrl,
      });
    } catch (error) {
      console.error("Error handling Google login:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

  if (!hasMounted) return null;

  // Show welcome page with public timer when logged out
  if (!user) {
    return (
      <div className="min-h-screen overflow-hidden transition-colors duration-300">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <motion.div
            className="absolute w-80 h-80 "
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [360, 180, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Header Section */}
          <div className="text-center max-w-4xl mx-auto pt-10 px-4">
            {/* Logo */}
            <motion.div
              className="flex items-center justify-center mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Image
                src="/logo/pomodrive-svg/pomoDrive-logo-light.svg"
                alt="PomoDRIVE Logo"
                width={192}
                height={80}
                className="h-20 md:h-48 w-auto block dark:hidden"
                priority
              />
              <Image
                src="/logo/pomodrive-svg/pomoDrive-logo.svg"
                alt="PomoDRIVE Logo"
                width={192}
                height={80}
                className="h-20 md:h-48 w-auto hidden dark:block"
                priority
              />
            </motion.div>

            {/* Subtitle */}
            <motion.h2
              className="text-xl md:text-2xl font-semibold text-fg mb-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Supercharge Your Productivity
            </motion.h2>

            {/* Description */}
            <motion.p
              className="text-md text-fg-muted mb-8 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              Try our Pomodoro timer right now! Focus better, work smarter, and
              boost your productivity.
            </motion.p>

            {/* Sign In CTA */}
            <motion.div
              className="flex flex-col items-center space-y-4 mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            >
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
            </motion.div>
          </div>

          {/* Public Timer Section */}
          <motion.div
            className="max-w-7xl mx-auto px-4 pb-20"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            {/* Timer Card */}
            <div className="bg-surface/80 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-edge shadow-2xl transition-colors duration-300">
              {/* Public Timer Controls */}
              <PublicTimerControls showNotification={showNotification} />

              {/* Features Highlight */}
              <motion.div
                className="mt-8 pt-6 border-t border-edge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.5 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-surface-2 backdrop-blur-sm rounded-xl p-6 border border-edge transition-colors duration-300">
                    <div className="w-12 h-12 bg-primary-soft rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-fg">
                      Project Management
                    </h3>
                    <p className="text-fg-muted text-sm">
                      Organize tasks by projects and milestones. Track what
                      you&apos;re working on across all your sessions.
                    </p>
                  </div>

                  <div className="bg-surface-2 backdrop-blur-sm rounded-xl p-6 border border-edge transition-colors duration-300">
                    <div className="w-12 h-12 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-fg">
                      Productivity Analytics
                    </h3>
                    <p className="text-fg-muted text-sm">
                      Beautiful charts and insights showing your daily, weekly,
                      and monthly productivity patterns.
                    </p>
                  </div>

                  <div className="bg-surface-2 backdrop-blur-sm rounded-xl p-6 border border-edge transition-colors duration-300">
                    <div className="w-12 h-12 bg-success-soft rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-fg">
                      Session History
                    </h3>
                    <p className="text-fg-muted text-sm">
                      Keep track of all your completed sessions, see your
                      streaks, and monitor your progress over time.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Logged in: the dashboard is the home screen (see the redirect effect above).
  return null;
}
