"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import ThemeToggle from "./ThemeToggle";
import { validateStoredToken } from "@/utils/tokenValidator";

/* ── Nav icon components ───────────────────────────────── */

function IconTimer({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="12" cy="13" r="8" />
      <path strokeLinecap="round" d="M12 9v4l2.5 2.5M12 5V3M10 3h4" />
    </svg>
  );
}

function IconTasks({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function IconHabits({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h2M4 9h2M4 13h2M4 17h2M8 5h12M8 9h12M8 13h8M8 17h10"
      />
    </svg>
  );
}

function IconAnalytics({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function IconSettings({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Timer", Icon: IconTimer },
  { href: "/tasks", label: "Tasks", Icon: IconTasks },
  { href: "/habits", label: "Habits", Icon: IconHabits },
  { href: "/analytics", label: "Analytics", Icon: IconAnalytics },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

const Navbar = ({ user, onLogout }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const pathname = usePathname();

  // Validate token on component mount
  useEffect(() => {
    validateStoredToken();
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      console.log("=== Navbar: Google login started ===");

      // Decode the Google JWT token to get user info
      const decodedToken = jwtDecode(credentialResponse.credential);
      console.log("Google user:", decodedToken.email);

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

      // Store our backend JWT and user info
      localStorage.setItem("accessToken", token);
      localStorage.setItem("userId", backendUser.userId || backendUser._id);
      localStorage.setItem("userName", backendUser.name);

      console.log("localStorage after setting:");
      console.log("- userId:", localStorage.getItem("userId"));
      console.log("- userName:", localStorage.getItem("userName"));

      // Close modal and refresh page to trigger parent component state update
      setShowLoginModal(false);
      window.location.reload();
    } catch (error) {
      console.error("Error handling Google login:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

  const handleLogout = () => {
    onLogout();
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
        <motion.nav
          className="max-w-7xl mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-xl transition-colors duration-300"
          initial={{ y: -100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Logo Section - Left */}
            <motion.div
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Link href="/" className="flex items-center space-x-3">
                <img
                  src="/logo/pomodrive-svg/pomoDrive-horizontal-light.svg"
                  alt="PomoDRIVE"
                  className="h-10 block dark:hidden"
                />
                <img
                  src="/logo/pomodrive-svg/pomoDrive-horizontal.svg"
                  alt="PomoDRIVE"
                  className="h-10 hidden dark:block"
                />
              </Link>
            </motion.div>

            {/* Navigation Items - Center */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50/80 dark:bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.Icon}
                />
              ))}
            </div>

            {/* Auth Section - Right */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {user ? (
                <div className="flex items-center space-x-4">
                  <motion.div
                    className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-[#88b6ff]/10 to-[#014acd]/10 dark:from-[#88b6ff]/20 dark:to-[#014acd]/20 px-4 py-2 rounded-xl border border-[#88b6ff]/30 dark:border-[#88b6ff]/40"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[#88b6ff] to-[#014acd] rounded-full flex items-center justify-center shadow-lg shadow-[#88b6ff]/25">
                      <span className="text-white text-sm font-semibold">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-800 dark:text-gray-200 text-sm font-semibold">
                      {user.name}
                    </span>
                  </motion.div>
                  {/* Desktop logout (mobile logout lives in burger menu) */}
                  <motion.button
                    onClick={handleLogout}
                    className="hidden md:inline-flex px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Logout
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  onClick={handleLogin}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#88b6ff] to-[#014acd] hover:from-[#014acd] hover:to-[#88b6ff] text-white font-semibold rounded-xl shadow-lg shadow-[#88b6ff]/30 transition-all duration-200"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Login
                </motion.button>
              )}
            </div>

            {/* Mobile Auth Button */}
            <div className="md:hidden">
              <button
                type="button"
                aria-label={user ? "Logout" : "Login"}
                onClick={user ? handleLogout : handleLogin}
                className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              >
                {user ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </motion.nav>
      </div>

      {/* Mobile Sub-navbar with icons */}
      <div className="fixed top-[76px] left-0 right-0 z-50 md:hidden px-4 pt-1">
        <div className="max-w-7xl mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-lg">
          <div className="flex items-center justify-around px-2 py-1.5">
            {NAV_ITEMS.map((item) => (
              <MobileNavIcon
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.Icon}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-2xl transition-colors duration-300"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome to PomoDRIVE
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Sign in to track your productivity sessions
                </p>
              </div>

              <div className="flex flex-col items-center space-y-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  theme="filled_blue"
                />

                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="text-center text-sm text-gray-500 mt-4">
                <p>Your data is secure and private</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// NavLink Component for desktop navigation items
const NavLink = ({ href, label, Icon }) => {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={isActive ? "page" : undefined}>
      <motion.span
        className={`relative flex items-center gap-1.5 px-4 py-2 transition-colors duration-200 cursor-pointer group rounded-lg ${
          isActive
            ? "text-gray-900 dark:text-white font-semibold"
            : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon className="w-4 h-4" />
        {label}
        <motion.span
          className={`absolute inset-0 bg-gradient-to-r from-[#88b6ff]/10 to-[#014acd]/10 rounded-lg -z-10 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        ></motion.span>
      </motion.span>
    </Link>
  );
};

// Mobile icon nav link for sub-navbar
const MobileNavIcon = ({ href, label, Icon }) => {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors duration-200 ${
        isActive
          ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/80 dark:bg-blue-900/30"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
};

export default Navbar;
