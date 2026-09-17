"use client";

// /tasks/routine?projectId=<id>
// Uses a query parameter rather than a dynamic segment so the page can be
// statically exported into the mobile and desktop apps.

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import RoutineTasksView from "@/components/RoutineTasksView";

function IconBack({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function RoutineTasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") || "";

  const [user, setUser] = useState(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        setUser(jwtDecode(token));
      } catch {
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const headers = (() => {
      if (typeof window === "undefined") return {};
      const userId = localStorage.getItem("userId");
      return userId ? { "user-id": userId } : {};
    })();
    fetch("/api/projects", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const proj = (data || []).find((p) => p._id === projectId);
        if (proj) setProjectName(proj.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    setUser(null);
  }, []);

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            onClick={() => router.push("/planner?tab=routines&view=cycles")}
            aria-label="Back to planner"
          >
            <IconBack className="w-5 h-5 text-fg-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-fg">Cycles</h1>
            {projectName ? (
              <p className="text-sm text-fg-subtle">{projectName}</p>
            ) : null}
          </div>
        </div>

        {projectId ? (
          <RoutineTasksView projectId={projectId} />
        ) : (
          <p className="text-fg-muted">No project selected.</p>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="w-screen min-h-screen" />}>
      <RoutineTasksPage />
    </Suspense>
  );
}
