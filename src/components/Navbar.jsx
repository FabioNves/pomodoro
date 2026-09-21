"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SignInButton from "@/components/auth/SignInButton";
import { validateStoredToken } from "@/utils/tokenValidator";
import { useAccess } from "@/lib/access/client";
import { IconLock } from "@/components/access/Gate";
import TimerBadge from "@/components/timer/TimerBadge";
import UserMenu from "@/components/nav/UserMenu";

/* ── Nav icon components ───────────────────────────────── */

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

function IconNews({ className = "" }) {
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
        d="M4 5h12a2 2 0 012 2v12a2 2 0 002-2V9M4 5v14a2 2 0 002 2h14M8 9h6M8 13h6M8 17h4"
      />
    </svg>
  );
}

function IconNotebook({ className = "" }) {
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
        d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6a1 1 0 01-1-1V4a1 1 0 011-1zM4 7h2M4 11h2M4 15h2M10 8h5M10 12h4"
      />
    </svg>
  );
}

function IconBusiness({ className = "" }) {
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
        d="M4 8h16a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a1 1 0 011-1zM9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18M12 12v2"
      />
    </svg>
  );
}

// The screens of the app. Settings, the admin page and the view-as switcher
// are not here: they belong to the account, so they live in UserMenu. Nor is
// the timer, which lives on the dashboard with TimerBadge showing a running
// session from every page.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", short: "Home", Icon: IconDashboard },
  { href: "/planner", label: "Planner", short: "Plan", Icon: IconTasks, feature: "planner" },
  { href: "/notebook", label: "Notebook", short: "Notes", Icon: IconNotebook, feature: "notebook" },
  { href: "/business", label: "Business", short: "Biz", Icon: IconBusiness, feature: "business" },
  { href: "/analytics", label: "Analytics", short: "Stats", Icon: IconAnalytics, feature: "analytics" },
  { href: "/news", label: "News", short: "News", Icon: IconNews, feature: "news_briefing" },
];

const Navbar = ({ user, onLogout }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const pathname = usePathname();
  const access = useAccess();
  const isLocked = (item) => Boolean(item.feature && access.feature(item.feature)?.locked);
  // Admin-only screens are left out of the menu for everyone else.
  const items = NAV_ITEMS.filter((item) => !(item.feature && access.hidden(item.feature)));
  // Pricing is for anyone not on Premium yet: signed out, or signed in on a
  // free plan. Signed in it waits for the real role, rather than flashing at
  // a paying user while /api/me is still in flight.
  const showPricing = user ? Boolean(access.me) && access.role !== "premium" && access.role !== "admin" : true;

  // Validate token on component mount
  useEffect(() => {
    validateStoredToken();
  }, []);

  // SignInButton has already stored the session; reload so the page picks up
  // the signed-in state.
  const handleSignedIn = () => {
    setShowLoginModal(false);
    window.location.reload();
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
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.Icon}
                  locked={isLocked(item)}
                />
              ))}
            </div>

            {/* Account, pricing and the running session */}
            <div className="flex items-center gap-2 sm:gap-3">
              {showPricing ? (
                <Link
                  href="/pricing"
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-accent/40 bg-accent-soft text-accent text-xs font-semibold hover:bg-accent hover:text-accent-fg transition-colors"
                  data-testid="pricing-link"
                >
                  Pricing
                </Link>
              ) : null}
              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <TimerBadge />
                  <UserMenu user={user} onLogout={handleLogout} showPricing={showPricing} />
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

            {/* Phones, signed out: the account menu covers everything else. */}
            <div className={`md:hidden items-center gap-2 ${user ? "hidden" : "flex"}`}>
              <button
                type="button"
                aria-label="Login"
                onClick={handleLogin}
                className="text-fg-muted hover:text-fg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </motion.nav>
      </div>

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto bg-surface/90 backdrop-blur-xl rounded-xl border border-edge shadow-lg">
          <div className="flex items-center px-0.5 py-1">
            {items.map((item) => (
              <MobileNavIcon
                key={item.href}
                href={item.href}
                label={item.label}
                short={item.short}
                Icon={item.Icon}
                locked={isLocked(item)}
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
                <SignInButton onSuccess={handleSignedIn} />

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

// NavLink Component for desktop navigation items. The tabs have to share the
// bar with the logo, Pricing, the running timer and the account, so they are
// icons on a tablet (md), labels on a small laptop (lg) and both from xl up.
const NavLink = ({ href, label, Icon, locked = false }) => {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      title={locked ? `${label}: available on Premium` : label}
    >
      <motion.span
        className={`relative flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer group rounded-md ${
          isActive
            ? "text-fg font-semibold"
            : "text-fg-muted hover:text-fg font-medium"
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon className="w-4 h-4 lg:hidden xl:block" />
        <span className="hidden lg:inline">{label}</span>
        {locked ? <IconLock className="w-3 h-3 text-fg-subtle" /> : null}
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
const MobileNavIcon = ({ href, label, short, Icon, locked = false }) => {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 px-0.5 py-1.5 rounded-lg transition-colors duration-200 ${
        isActive
          ? "text-primary font-semibold bg-primary-soft"
          : "text-fg-subtle hover:text-fg-muted"
      }`}
    >
      <span className="relative">
        <Icon className="w-5 h-5 shrink-0" />
        {locked ? (
          <IconLock className="absolute -top-1 -right-1.5 w-2.5 h-2.5 text-fg-subtle" />
        ) : null}
      </span>
      <span className="text-[10px] leading-none w-full text-center truncate">
        {short || label}
      </span>
    </Link>
  );
};

export default Navbar;
