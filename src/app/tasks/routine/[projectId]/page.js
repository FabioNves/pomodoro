"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function RoutineTasksPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

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
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => router.push("/planner?tab=routines")}
            aria-label="Back to planner"
          >
            <IconBack className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Routine Tasks
            </h1>
            {projectName ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {projectName}
              </p>
            ) : null}
          </div>
        </div>

        <RoutineTasksView projectId={projectId} />
      </div>
    </div>
  );
}
