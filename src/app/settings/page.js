"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
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
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container mx-auto px-4 pb-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-600 dark:text-green-300 transition-colors duration-300">
            {successMessage}
          </div>
        )}

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
