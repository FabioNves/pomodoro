"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/hooks/useTheme";

/** Star used to mark the preferred theme: filled when chosen, outline otherwise. */
function StarIcon({ filled, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.6z" />
    </svg>
  );
}

/** Miniature app mock-up painted with a theme's preview colors. */
function ThemePreview({ preview }) {
  return (
    <div
      className="w-full h-20 rounded-lg overflow-hidden border border-edge"
      style={{ backgroundColor: preview.bg }}
      aria-hidden="true"
    >
      <div className="h-full p-2 flex flex-col gap-1.5">
        <div
          className="h-3 w-full rounded-sm"
          style={{ backgroundColor: preview.surface }}
        />
        <div className="flex-1 flex gap-1.5">
          <div
            className="flex-1 rounded-sm flex items-end p-1"
            style={{ backgroundColor: preview.surface }}
          >
            <span
              className="h-2 w-8 rounded-sm"
              style={{ backgroundColor: preview.primary }}
            />
          </div>
          <div
            className="w-8 rounded-sm flex items-start justify-end p-1"
            style={{ backgroundColor: preview.surface }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: preview.accent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();
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

  const currentTheme = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container mx-auto px-4 pb-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-success-soft border border-success/40 rounded-lg text-success transition-colors duration-300">
            {successMessage}
          </div>
        )}

        {/* Theme Preferences Section */}
        <div className="bg-surface rounded-lg p-6 border border-edge mb-6 transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-fg">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            Theme Preferences
          </h2>

          <div className="space-y-4">
            <div className="bg-surface-2 p-4 rounded-lg transition-colors duration-300">
              <h3 className="font-medium text-lg mb-2 text-fg">Appearance</h3>
              <p className="text-fg-muted text-sm mb-4 transition-colors duration-300">
                Star the look you like best. Your preferred theme is saved on
                this device and applied everywhere in the app.
              </p>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                role="radiogroup"
                aria-label="Theme"
              >
                {themes.map((t) => {
                  const active = t.id === theme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(t.id)}
                      title={
                        active
                          ? `${t.name} is your preferred theme`
                          : `Make ${t.name} your preferred theme`
                      }
                      className={`group text-left p-2.5 rounded-xl border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-focus/40 ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-edge hover:border-edge-strong bg-surface"
                      }`}
                    >
                      <ThemePreview preview={t.preview} />
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-fg truncate">
                            {t.name}
                          </p>
                          <span
                            className={`shrink-0 transition-colors duration-200 ${
                              active
                                ? "text-accent"
                                : "text-fg-subtle group-hover:text-accent"
                            }`}
                          >
                            <StarIcon filled={active} className="w-5 h-5" />
                          </span>
                        </div>
                        <p className="text-[11px] text-fg-subtle truncate">
                          {t.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
                <StarIcon filled className="w-4 h-4 text-accent shrink-0" />
                <span>
                  Preferred theme:{" "}
                  <strong className="text-fg">{currentTheme.name}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-surface rounded-lg p-6 border border-edge transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-fg">Account</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg transition-colors duration-300">
              <div>
                <p className="font-medium text-fg">{user?.name}</p>
                <p className="text-sm text-fg-muted transition-colors duration-300">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-danger hover:bg-danger-hover text-white px-6 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
