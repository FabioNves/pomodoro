"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import PomodoroTimer from "../components/PomodoroTimer";
import PublicTimerControls from "../components/PublicTimer1/PublicTimerControls";
import Navbar from "../components/Navbar";

export default function App() {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  // Notification utilities
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return false;
  };

  const showNotification = (title, options = {}) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        body: options.body || "",
        tag: "pomodoro-timer",
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        actions: options.actions || [],
        ...options,
      });

      notification.onclick = function () {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener(
          "notificationclick",
          function (event) {
            event.preventDefault();
            window.focus();

            if (event.action === "start-break" && options.onStartBreak) {
              options.onStartBreak();
            } else if (
              event.action === "finish-session" &&
              options.onFinishSession
            ) {
              options.onFinishSession();
            }

            event.notification.close();
          }
        );
      }

      setTimeout(() => {
        if (notification) {
          notification.close();
        }
      }, 15000);

      return notification;
    }
  };

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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decodedToken = jwtDecode(credentialResponse.credential);

      console.log("=== GOOGLE USER INFO ===");
      console.log("User ID:", decodedToken.sub);
      console.log("Email:", decodedToken.email);
      console.log("Name:", decodedToken.name);
      console.log("=======================");

      const userData = {
        userId: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
      };

      localStorage.setItem("accessToken", credentialResponse.credential);
      localStorage.setItem("userId", decodedToken.sub);
      setUser(userData);
    } catch (error) {
      console.error("Error handling Google login:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    setUser(null);
  };

  if (!hasMounted) return null;

  // Show welcome page with public timer when logged out
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"
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
              className="flex items-center justify-center mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl mr-4">
                <span className="text-white font-bold text-2xl">P</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                PomoDRIVE
              </h1>
            </motion.div>

            {/* Subtitle */}
            <motion.h2
              className="text-xl md:text-2xl font-semibold text-gray-300 mb-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Supercharge Your Productivity
            </motion.h2>

            {/* Description */}
            <motion.p
              className="text-md text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed"
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
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
              {/* Public Timer Controls */}
              <PublicTimerControls showNotification={showNotification} />

              {/* Features Highlight */}
              <motion.div
                className="mt-8 pt-6 border-t border-gray-700/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.5 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-blue-400"
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
                    <h3 className="text-lg font-semibold mb-2 text-white">
                      Project Management
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Organize tasks by projects and milestones. Track what
                      you&apos;re working on across all your sessions.
                    </p>
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-purple-400"
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
                    <h3 className="text-lg font-semibold mb-2 text-white">
                      Productivity Analytics
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Beautiful charts and insights showing your daily, weekly,
                      and monthly productivity patterns.
                    </p>
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-green-400"
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
                    <h3 className="text-lg font-semibold mb-2 text-white">
                      Session History
                    </h3>
                    <p className="text-gray-400 text-sm">
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

  // Show main app when logged in
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 ">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pt-24 pb-8">
        <PomodoroTimer showNotification={showNotification} />
      </main>
      <footer className="flex justify-center items-center h-8 bg-gray-800 text-white">
        <p>&copy; 2025 PomoDRIVE App</p>
      </footer>
    </div>
  );
}
