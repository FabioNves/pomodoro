"use client";

// Public pricing page. Both plans and every feature come from the feature
// registry (/api/pricing), so what the admin saves under Subscriptions is
// what this page shows; nothing is listed here by hand.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import { useAccess } from "@/lib/access/client";
import { formatPrice } from "@/lib/access/features";
import { openExternal } from "@/lib/platform";
import { Spinner } from "@/components/news/newsUi";
import { IconLock } from "@/components/access/Gate";

function IconCheck({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconX({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PlanColumn({ plan, features, current, signedIn, highlight }) {
  const included = (f) => (plan.key === "premium" ? f.availableToPremium : f.availableToFree);
  const comingSoon = plan.status === "coming_soon";

  let cta;
  if (current) {
    cta = (
      <button type="button" disabled className="w-full px-4 py-2.5 rounded-lg border border-edge text-sm font-semibold text-fg-muted cursor-default">
        Your current plan
      </button>
    );
  } else if (comingSoon) {
    cta = (
      <button type="button" disabled aria-disabled="true" className="w-full px-4 py-2.5 rounded-lg bg-surface-2 border border-edge text-sm font-semibold text-fg-subtle cursor-not-allowed">
        Coming soon
      </button>
    );
  } else if (plan.key === "free") {
    cta = signedIn ? (
      <Link href="/dashboard" className="block text-center w-full px-4 py-2.5 rounded-lg border border-edge text-sm font-semibold text-fg hover:bg-surface-hover transition-colors">
        Open the app
      </Link>
    ) : (
      <Link href="/" className="block text-center w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-semibold shadow-md shadow-primary/25 transition-colors">
        Get started
      </Link>
    );
  } else if (plan.checkoutUrl) {
    cta = (
      <button
        type="button"
        onClick={() => openExternal(plan.checkoutUrl)}
        className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold shadow-md shadow-accent/25 transition-colors"
      >
        Choose {plan.name}
      </button>
    );
  } else {
    cta = (
      <button
        type="button"
        onClick={() => toast("Sign-up for this plan is not open yet.")}
        className="w-full px-4 py-2.5 rounded-lg bg-surface-2 border border-edge text-sm font-semibold text-fg-muted"
      >
        Not available yet
      </button>
    );
  }

  return (
    <section
      className={`flex flex-col rounded-2xl border bg-surface shadow-md p-5 sm:p-6 ${highlight ? "border-accent/50" : "border-edge"}`}
      aria-label={`${plan.name} plan`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg">{plan.name}</h2>
          {plan.tagline ? <p className="text-sm text-fg-muted">{plan.tagline}</p> : null}
        </div>
        {comingSoon ? (
          <span className="shrink-0 inline-flex items-center rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Coming soon
          </span>
        ) : current ? (
          <span className="shrink-0 inline-flex items-center rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-4">
        <span className="text-4xl font-bold text-fg tabular-nums">{plan.price === 0 ? "Free" : formatPrice(plan)}</span>
        {plan.price === 0 ? null : <span className="text-sm text-fg-muted"> / {plan.interval}</span>}
      </p>
      <div className="mt-5">{cta}</div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => {
          const yes = included(f);
          return (
            <li key={f.key} className={`flex items-start gap-2.5 ${yes ? "text-fg" : "text-fg-subtle"}`} aria-label={`${f.name}: ${yes ? "included" : "not included"}`}>
              <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${yes ? "bg-success-soft text-success" : "bg-surface-2 text-fg-subtle"}`}>
                {yes ? <IconCheck className="w-3 h-3" /> : <IconX className="w-3 h-3" />}
              </span>
              <span className="min-w-0">
                <span className={`font-medium ${yes ? "" : "line-through decoration-edge-strong"}`}>{f.name}</span>
                {f.description ? <span className="block text-xs text-fg-muted">{f.description}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const access = useAccess();
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHasMounted(true);
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        setUser(jwtDecode(token));
      } catch {
        setUser(null);
      }
    }
    fetch("/api/pricing", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load pricing.");
        setData(await res.json());
      })
      .catch((e) => setError(e.message || "Could not load pricing."));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.replace("/");
  };

  if (!hasMounted) return null;

  const signedIn = Boolean(user);
  const onPremium = signedIn && (access.role === "premium" || access.role === "admin");
  const groups = data ? [...new Set(data.features.map((f) => f.group))] : [];
  const orderedFeatures = data ? groups.flatMap((g) => data.features.filter((f) => f.group === g)) : [];

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="container mx-auto px-4 pb-12 max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">Plans</h1>
          <p className="text-sm text-fg-muted mt-1">Every feature, on both plans. What a plan lacks is listed, not hidden.</p>
        </div>

        {error ? (
          <p className="text-sm text-danger text-center">{error}</p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 text-sm text-fg-muted">
            <Spinner /> Loading plans…
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 items-start">
            {data.plans.map((plan) => (
              <PlanColumn
                key={plan.key}
                plan={plan}
                features={orderedFeatures}
                signedIn={signedIn}
                current={signedIn && (plan.key === "premium" ? onPremium : !onPremium)}
                highlight={plan.key === "premium"}
              />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-fg-subtle flex items-center justify-center gap-1.5">
          <IconLock className="w-3 h-3" />
          Locked features stay visible in the app, greyed out, and lead back here.
        </p>
      </main>
    </div>
  );
}
