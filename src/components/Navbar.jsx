"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import ThemeToggle from "./ThemeToggle";
import { validateStoredToken } from "@/utils/tokenValidator";

const Navbar = ({ user, onLogout }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const router = useRouter();

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

      console.log("=== Navbar: Setting localStorage ===");
      console.log("Backend user:", backendUser);
      console.log("Setting userId to:", backendUser.userId || backendUser._id);

      // Store our backend JWT and user info
      console.log(
        "[Navbar] Storing token after Google auth:",
        token ? `${token.substring(0, 50)}...` : "null"
      );
      console.log(
        "[Navbar] Storing userId:",
        backendUser.userId || backendUser._id
      );
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
    onLogout(); // Call the parent's logout handler
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-white/70 via-[#f3f0f9]/70 to-white/70 dark:from-gray-900/70 dark:via-gray-800/70 dark:to-gray-900/70 backdrop-blur-lg border-b border-gray-300/50 dark:border-gray-600/50 shadow-2xl transition-colors duration-300"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          clipPath: "polygon(0 0, 100% 0, 95% 85%, 5% 85%)",
          paddingBottom: "20px",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo Section - Left */}
          <motion.div
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
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
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/" label="Timer" />
            <NavLink href="/analytics" label="Analytics" />
            <NavLink href="/settings" label="Settings" />
          </div>

          {/* Auth Section - Right */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center space-x-4">
                <motion.div
                  className="hidden sm:flex items-center space-x-2 bg-white/50 dark:bg-gray-900/50 px-3 py-2 rounded-lg border border-gray-300/50 dark:border-gray-500/50 transition-colors duration-300"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-[#88b6ff] to-[#014acd] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-gray-800 dark:text-gray-200 text-sm font-medium">
                    {user.name}
                  </span>
                </motion.div>
                <motion.button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-red-500/25"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Logout
                </motion.button>
              </div>
            ) : (
              <motion.button
                onClick={handleLogin}
                className="px-6 py-2 bg-gradient-to-r from-[#88b6ff] to-[#014acd] hover:from-[#014acd] hover:to-[#88b6ff] text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-blue-500/25"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                Login
              </motion.button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="text-gray-300 hover:text-white transition-colors">
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.nav>

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
              className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 border border-gray-300 dark:border-gray-700 transition-colors duration-300"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
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

// NavLink Component for navigation items
const NavLink = ({ href, label }) => {
  return (
    <Link href={href}>
      <motion.span
        className="relative text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors duration-200 cursor-pointer group"
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {label}
        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-[#88b6ff] to-[#014acd] group-hover:w-full transition-all duration-300"></span>
      </motion.span>
    </Link>
  );
};

export default Navbar;
