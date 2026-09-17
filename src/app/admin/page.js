"use client";

// Admin page: connections, usage, users and subscriptions. Only the real
// admin gets it; everyone else sees the app's 404, exactly as for a route
// that does not exist. The section lives in ?tab= so links keep their place.

import React, { Suspense, useEffect, useState } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import { useAccess } from "@/lib/access/client";
import { IconCard, IconChart, IconPlug, IconUsers } from "@/components/admin/adminUi";
import AdminConnections from "@/components/admin/AdminConnections";
import AdminUsage from "@/components/admin/AdminUsage";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";

const TABS = [
  { key: "connections", label: "Connections", Icon: IconPlug },
  { key: "usage", label: "Usage", Icon: IconChart },
  { key: "users", label: "Users", Icon: IconUsers },
  { key: "subscriptions", label: "Subscriptions", Icon: IconCard },
];

function AdminScreen() {
  const access = useAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : "connections";

  // Not the admin (or not signed in): the page does not exist.
  if (!access.loading && !access.isAdmin) notFound();
  if (!access.me) return null;
  if (!access.isAdmin) return null;

  const setTab = (key) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="container mx-auto px-4 pb-12 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">Admin</h1>
        <p className="text-sm text-fg-muted mt-1">Connections, usage, users and the feature registry that drives plans and pricing.</p>
      </div>

      <div className="flex items-center gap-1 bg-surface-2/80 px-1.5 py-1 rounded-lg border border-edge mb-5 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <t.Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-surface/70 backdrop-blur-sm rounded-2xl border border-edge shadow-md p-4 sm:p-6 transition-colors duration-300">
        {tab === "connections" ? <AdminConnections /> : null}
        {tab === "usage" ? <AdminUsage /> : null}
        {tab === "users" ? <AdminUsers selfId={access.user?.id} /> : null}
        {tab === "subscriptions" ? <AdminSubscriptions /> : null}
      </div>
    </div>
  );
}

export default function AdminPage() {
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
    // Signed out: nothing to show here, and nothing to reveal.
    notFound();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.replace("/");
  };

  if (!hasMounted || !user) return null;

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pb-8">
        <Suspense fallback={<div className="container mx-auto px-4 max-w-6xl text-sm text-fg-muted">Loading…</div>}>
          <AdminScreen />
        </Suspense>
      </main>
    </div>
  );
}
