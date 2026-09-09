"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
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

function IconDashboard({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/timer", label: "Timer", Icon: IconTimer },
  { href: "/planner", label: "Planner", Icon: IconTasks },
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
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-3">
        <motion.nav
          className="max-w-7xl mx-auto bg-surface/80 backdrop-blur-xl rounded-xl border border-edge shadow-lg transition-colors duration-300"
          initial={{ y: -100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="px-4 py-1.5 flex items-center justify-between">
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
                  className="h-7 block dark:hidden"
                />
                <img
                  src="/logo/pomodrive-svg/pomoDrive-horizontal.svg"
                  alt="PomoDRIVE"
                  className="h-7 hidden dark:block"
                />
              </Link>
            </motion.div>

            {/* Navigation Items - Center */}
            <div className="hidden md:flex items-center gap-1 bg-surface-2/80 px-1.5 py-1 rounded-lg border border-edge backdrop-blur-sm">
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
            <div className="flex items-center space-x-3">
              {user ? (
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="hidden sm:flex items-center gap-2 bg-primary-soft px-2.5 py-1 rounded-lg border border-edge"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-6 h-6 bg-gradient-to-br from-gradient-start to-gradient-end rounded-full flex items-center justify-center shadow-md shadow-primary/25">
                      <span className="text-primary-fg text-[11px] font-semibold">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-fg text-xs font-semibold">
                      {user.name}
                    </span>
                  </motion.div>
                  {/* Desktop logout (mobile logout lives in burger menu) */}
                  <motion.button
                    onClick={handleLogout}
                    className="hidden md:inline-flex px-3.5 py-1.5 bg-danger hover:bg-danger-hover text-white text-sm font-semibold rounded-lg shadow-md shadow-danger/25 transition-all duration-200"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Logout
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  onClick={handleLogin}
                  className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-semibold rounded-lg shadow-md shadow-primary/30 transition-all duration-200"
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
                className="text-fg-muted hover:text-fg transition-colors"
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

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto bg-surface/90 backdrop-blur-xl rounded-xl border border-edge shadow-lg">
          <div className="flex items-center justify-around px-1 py-1">
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
              className="bg-surface rounded-2xl p-8 max-w-md w-full mx-4 border border-edge shadow-2xl transition-colors duration-300"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-fg mb-2">
                  Welcome to PomoDRIVE
                </h2>
                <p className="text-fg-muted">
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
                  className="text-fg-subtle hover:text-fg transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="text-center text-sm text-fg-subtle mt-4">
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
        className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors duration-200 cursor-pointer group rounded-md ${
          isActive
            ? "text-fg font-semibold"
            : "text-fg-muted hover:text-fg font-medium"
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon className="w-4 h-4" />
        {label}
        <motion.span
          className={`absolute inset-0 bg-primary-soft rounded-lg -z-10 transition-opacity ${
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
          ? "text-primary font-semibold bg-primary-soft"
          : "text-fg-subtle hover:text-fg-muted"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
};

export default Navbar;
