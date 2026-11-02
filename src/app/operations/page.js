"use client";

// Operations: the running side of things, as sections in a sidebar like the
// planner's. Business is the six-phase business workspace (admin only);
// Personal Budget the monthly money view (src/components/budget). The open
// section is ?section= (absent means DEFAULT_SECTION); each section keeps the rest of the query for itself:
// Business reads ?b= / ?phase= / ?item=, the budget ?view= / ?month= / ?year=.

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import BusinessApp from "@/components/business/BusinessApp";
import BudgetApp from "@/components/budget/BudgetApp";
import { LockedScreen } from "@/components/access/Gate";
import { useAccess } from "@/lib/access/client";
import BrandLoader from "@/components/brand/BrandLoader";

const SECTIONS = [
  {
    key: "business",
    label: "Business",
    hint: "Define, build, launch, operate, measure and improve",
    feature: "business",
  },
  { key: "budget", label: "Personal Budget", hint: "Income, expenses and investments", feature: "budget" },
];
const DEFAULT_SECTION = "business";

function OperationsInner({ user, onLogout }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const access = useAccess();
  // Admin-only sections are left out for everyone else, as in the navbar.
  const sections = SECTIONS.filter((s) => !(s.feature && access.hidden(s.feature)));
  const sectionParam = searchParams.get("section");
  const active =
    sections.find((s) => s.key === sectionParam) ||
    sections.find((s) => s.key === DEFAULT_SECTION) ||
    sections[0];

  // A section's own query (?b=, ?phase=…) means nothing to the others, so
  // switching starts from a clean one.
  const setSection = useCallback(
    (key) => router.push(`/operations?section=${key}`, { scroll: false }),
    [router],
  );

  const nav = (
    <nav
      className="bg-surface border border-edge rounded-2xl shadow-sm p-2 space-y-0.5"
      aria-label="Operations sections"
    >
      {sections.map((s) => {
        const isActive = active?.key === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            title={s.hint}
            aria-current={isActive ? "page" : undefined}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-soft text-primary"
                : "text-fg-muted hover:bg-surface-hover hover:text-fg"
            }`}
          >
            {s.label}
            {isActive ? <span className="w-1.5 h-1.5 rounded-full bg-primary" /> : null}
          </button>
        );
      })}
    </nav>
  );

  const main =
    active?.key === "business" ? (
      <LockedScreen
        feature="business"
        title="Business"
        description="Six connected phases for creating, running and improving a business."
      >
        <BusinessApp />
      </LockedScreen>
    ) : (
      <LockedScreen
        feature="budget"
        title="Personal Budget"
        description="Income, expenses and investments, month by month."
      >
        <BudgetApp />
      </LockedScreen>
    );

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={onLogout} />

      {/* Phones: the sections as a strip above the content. */}
      <div className="md:hidden px-3 pt-2 pb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-surface border border-edge" role="tablist" aria-label="Operations sections">
          {sections.map((s) => {
            const isActive = active?.key === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSection(s.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full flex md:px-6 md:gap-4 pb-8">
        <aside className="hidden md:block w-[240px] shrink-0">
          <div className="sticky top-[5.5rem]">{nav}</div>
        </aside>
        <main className="flex-1 min-w-0">{main}</main>
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        setUser(jwtDecode(token));
        return;
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("accessToken");
      }
    }
    router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.replace("/");
  };

  if (!hasMounted || !user) return <BrandLoader screen />;

  return (
    <Suspense fallback={<BrandLoader screen />}>
      <OperationsInner user={user} onLogout={handleLogout} />
    </Suspense>
  );
}
