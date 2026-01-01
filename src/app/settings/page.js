"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [hasTasksAccess, setHasTasksAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);

          // Check if user has Google Tasks access
          checkGoogleTasksAccess();
        } catch (error) {
          console.error("Error decoding token:", error);
          localStorage.removeItem("accessToken");
          router.push("/");
        }
      } else {
        router.push("/");
      }
    }
  }, [router]);

  const checkGoogleTasksAccess = async () => {
    setCheckingAccess(true);
    try {
      const userId = localStorage.getItem("userId");
      console.log("=== Settings: Checking tasks access ===");
      console.log("userId from localStorage:", userId);
      console.log("All localStorage keys:", Object.keys(localStorage));

      const response = await fetch("/api/user/check-tasks-access", {
        headers: {
          "user-id": userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasTasksAccess(data.hasAccess);
      }
    } catch (error) {
      console.error("Error checking tasks access:", error);
    } finally {
      setCheckingAccess(false);
    }
  };

  // Reauthorization flow for Google Tasks
  const reauthorize = useGoogleLogin({
    scope:
      "https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    onSuccess: async (tokenResponse) => {
      try {
        setReauthorizing(true);
        const { access_token, refresh_token, expires_in } = tokenResponse;

        if (!access_token) {
          throw new Error("Missing access token");
        }

        // Send tokens to backend to update user
        const backendResponse = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
          }),
        });

        if (!backendResponse.ok) {
          throw new Error("Failed to update tokens");
        }

        const { token, user: backendUser } = await backendResponse.json();

        // Update local storage
        localStorage.setItem("accessToken", token);
        localStorage.setItem("userId", backendUser.userId || backendUser._id);
        localStorage.setItem("userName", backendUser.name);

        setSuccessMessage("✅ Google Tasks access granted successfully!");
        setHasTasksAccess(true);
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error) {
        console.error("Error processing reauthorization:", error);
        alert("Failed to grant Google Tasks access. Please try again.");
      } finally {
        setReauthorizing(false);
      }
    },
    onError: (error) => {
      console.error("Reauthorization failed:", error);
      setReauthorizing(false);
      alert("Authorization cancelled or failed.");
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.push("/");
  };

  if (!hasMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f3f0f9] dark:bg-[#0a0a0a] text-gray-900 dark:text-white transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-600 dark:text-green-300 transition-colors duration-300">
            {successMessage}
          </div>
        )}

        {/* Google Integration Section */}
        <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-300 dark:border-gray-700/50 mb-6 transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <svg
              className="w-6 h-6 text-blue-500 dark:text-blue-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google Integration
          </h2>

          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg transition-colors duration-300">
              <h3 className="font-medium text-lg mb-2 text-gray-900 dark:text-white">
                Google Tasks Access
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 transition-colors duration-300">
                Connect your Google Tasks to import tasks directly into
                PomoDRIVE. This allows you to sync your existing tasks and work
                on them during Pomodoro sessions.
              </p>

              {checkingAccess ? (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  Checking access status...
                </div>
              ) : hasTasksAccess ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg transition-colors duration-300">
                  <svg
                    className="w-6 h-6 text-green-500 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-green-700 dark:text-green-300 font-medium transition-colors duration-300">
                      Google Tasks Connected
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">
                      Your Google Tasks are synced and ready to use
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => reauthorize()}
                    disabled={reauthorizing}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    {reauthorizing ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Grant Google Tasks Access
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-3 transition-colors duration-300">
                    You&apos;ll be redirected to Google to authorize access to
                    your tasks. This is required for existing users who signed
                    in before this feature was added.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Theme Preferences Section */}
        <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-300 dark:border-gray-700/50 mb-6 transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <svg
              className="w-6 h-6 text-purple-500 dark:text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            Theme Preferences
          </h2>

          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg transition-colors duration-300">
              <h3 className="font-medium text-lg mb-2 text-gray-900 dark:text-white">
                Appearance
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 transition-colors duration-300">
                Choose your preferred theme for PomoDRIVE. Your selection will
                be saved and applied across all your sessions.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (theme === "dark") toggleTheme();
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all duration-300 ${
                    theme === "light"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg
                      className="w-6 h-6 text-yellow-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Light Mode
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Bright and clean
                  </p>
                </button>

                <button
                  onClick={() => {
                    if (theme === "light") toggleTheme();
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all duration-300 ${
                    theme === "dark"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg
                      className="w-6 h-6 text-purple-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Dark Mode
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Easy on the eyes
                  </p>
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Current theme:{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {theme === "dark" ? "Dark Mode" : "Light Mode"}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-300 dark:border-gray-700/50 transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Account
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg transition-colors duration-300">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user?.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
