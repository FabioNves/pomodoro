"use client";

// Home screen for signed-in users: every feature summarised on one page, with
// a live timer and a shortcut into each area.

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import TimerControls from "@/components/TimerControls";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import { apiJson } from "@/utils/apiClient";
import { COLOR_PALETTES } from "@/lib/habitPalettes";
import { getMondayOf } from "@/utils/timeUtils";
import {
  requestNotificationPermission,
  showNotification,
} from "@/utils/notifications";

// Where each dashboard section sends the user.
const ROUTES = {
  timer: "/timer",
  analytics: "/analytics",
  tasks: "/planner?tab=tasks",
  calendar: "/planner?tab=calendar",
  schedule: "/planner?tab=schedule",
  habits: "/planner?tab=habits",
  routines: "/planner?tab=routines",
};

function loadActiveProject() {
  try {
    const saved = localStorage.getItem("activeProject");
    if (!saved) return { projectId: "", title: "" };
    const parsed = JSON.parse(saved);
    return { projectId: parsed?.projectId || "", title: parsed?.title || "" };
  } catch {
    return { projectId: "", title: "" };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [weekPlans, setWeekPlans] = useState([]);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Same persisted selection the timer page uses, so both stay in sync.
  const [activeProject, setActiveProject] = useState({
    projectId: "",
    title: "",
  });

  /* ── auth ─────────────────────────────────────────── */
  useEffect(() => {
    setHasMounted(true);
    requestNotificationPermission();
    setActiveProject(loadActiveProject());

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
    setUser(null);
    router.replace("/");
  };

  /* ── data ─────────────────────────────────────────── */
  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await apiJson("/api/sessions"));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const safe = (p) =>
      p.catch((e) => {
        console.error(e);
        return [];
      });
    (async () => {
      const year = new Date().getFullYear();
      const [prj, tks, hbs, ents, plans, sess] = await Promise.all([
        safe(apiJson("/api/projects")),
        safe(apiJson("/api/tasks")),
        safe(apiJson("/api/habits")),
        safe(apiJson(`/api/habits/entries?year=${year}`)),
        safe(apiJson("/api/week-plans")),
        safe(apiJson("/api/sessions")),
      ]);
      if (cancelled) return;
      setProjects(prj);
      setTasks(tks);
      setHabits(hbs);
      setEntries(ents);
      setWeekPlans(plans);
      setSessions(sess);
      const routines = await Promise.all(
        prj.map((p) => safe(apiJson(`/api/routine-tasks?projectId=${p._id}`))),
      );
      if (cancelled) return;
      setRoutineTasks(routines.flat());
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // The current week's plan when it exists, otherwise the most recent one.
  const weekPlan = (() => {
    if (!weekPlans.length) return null;
    const monday = getMondayOf(new Date());
    return weekPlans.find((wp) => wp.weekStart === monday) || weekPlans[0];
  })();

  /* ── timer ────────────────────────────────────────── */
  const chooseProject = (projectId) => {
    const p = projects.find((x) => String(x._id) === projectId);
    const next = p ? { projectId: String(p._id), title: p.name } : { projectId: "", title: "" };
    setActiveProject(next);
    try {
      localStorage.setItem("activeProject", JSON.stringify(next));
    } catch {}
  };

  const handleSessionCompletion = useCallback(
    async (focus, brk) => {
      if (!activeProject.title) {
        toast.error("Pick a project for this session first.");
        return;
      }
      try {
        await apiJson("/api/sessions", {
          method: "POST",
          body: JSON.stringify({
            focusTime: focus,
            breakTime: brk,
            currentProject: activeProject,
            tasks: [],
          }),
        });
        toast.success(`Saved a ${focus}-minute session on ${activeProject.title}.`);
        showNotification("🎯 Session Completed!", {
          body: `Great work! You completed a ${focus}-minute focus session on ${activeProject.title}.`,
          icon: "/favicon.ico",
        });
        refreshSessions();
      } catch (e) {
        console.error("Error saving session", e);
        toast.error("Could not save the session.");
      }
    },
    [activeProject, refreshSessions],
  );

  const navigate = useCallback(
    (key) => router.push(ROUTES[key] || "/planner"),
    [router],
  );

  if (!hasMounted || !user) return null;

  const timerSlot = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="dashboard-project"
          className="text-xs text-fg-subtle shrink-0"
        >
          Project
        </label>
        <select
          id="dashboard-project"
          value={activeProject.projectId}
          onChange={(e) => chooseProject(e.target.value)}
          className="flex-1 min-w-[160px] max-w-xs px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg focus:border-focus outline-none"
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p._id} value={String(p._id)}>
              {p.name}
            </option>
          ))}
        </select>
        {!activeProject.title ? (
          <span className="text-[11px] text-warning">
            Needed to save sessions
          </span>
        ) : null}
      </div>
      <TimerControls
        handleSessionCompletion={handleSessionCompletion}
        showNotification={showNotification}
        activeProject={activeProject}
      />
    </div>
  );

  return (
    <div className="min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pb-8">
        <DashboardOverview
          user={user}
          loaded={loaded}
          projects={projects}
          tasks={tasks}
          habits={habits}
          entries={entries}
          weekPlan={weekPlan}
          routineTasks={routineTasks}
          sessions={sessions}
          palettes={COLOR_PALETTES}
          timerSlot={timerSlot}
          onNavigate={navigate}
        />
      </main>
    </div>
  );
}
