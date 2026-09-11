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
import WeekCalendar from "@/components/weekplan/WeekCalendar";
import Dropdown from "@/components/ui/Dropdown";
import { useWeekPlanTasks } from "@/hooks/useWeekPlanTasks";
import { apiJson } from "@/utils/apiClient";
import { COLOR_PALETTES } from "@/lib/habitPalettes";
import { projectOptions, getProjectColorMeta } from "@/lib/projectColors";
import {
  dayTasksForPlan,
  routineColorMap,
  makeProjectResolver,
  idOf,
} from "@/lib/weekPlanView";
import { getMondayOf, weekLabel } from "@/utils/timeUtils";
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

// Sessions need a label; a project is optional so unassigned work still saves.
const NO_PROJECT_LABEL = "Unassigned";

// Today plus the next two days, when the calendar card is widened.
const CALENDAR_EXPANDED_DAYS = 3;
const CALENDAR_WIDTH_KEY = "dashboardCalendarExpanded";

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
  // What is being worked on: a todo, a routine task, or a typed name.
  const [activeTask, setActiveTask] = useState("");
  // Calendar card width, remembered per device.
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  const toggleCalendar = useCallback(() => {
    setCalendarExpanded((open) => {
      const next = !open;
      try {
        localStorage.setItem(CALENDAR_WIDTH_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  /* ── auth ─────────────────────────────────────────── */
  useEffect(() => {
    setHasMounted(true);
    requestNotificationPermission();
    setActiveProject(loadActiveProject());
    try {
      setCalendarExpanded(localStorage.getItem(CALENDAR_WIDTH_KEY) === "1");
    } catch {}

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

  // This week's plan drives the today column; the summary falls back to the
  // most recent plan when this week has none yet.
  const monday = getMondayOf(new Date());
  const currentWeekPlan =
    weekPlans.find((wp) => wp.weekStart === monday) || null;
  const weekPlan = currentWeekPlan || weekPlans[0] || null;

  const setPlan = useCallback((updated) => {
    if (!updated?._id) return;
    setWeekPlans((prev) =>
      prev.some((wp) => wp._id === updated._id)
        ? prev.map((wp) => (wp._id === updated._id ? updated : wp))
        : [updated, ...prev],
    );
  }, []);

  // Created on demand the first time something is added to today's column.
  const createPlan = useCallback(async () => {
    try {
      const created = await apiJson("/api/week-plans", {
        method: "POST",
        body: JSON.stringify({
          name: weekLabel(monday),
          weekStart: monday,
          projects: projects.map((p) => p._id),
        }),
      });
      setPlan(created);
      return created;
    } catch (e) {
      console.error(e);
      toast.error("Could not create this week's plan.");
      return null;
    }
  }, [monday, projects, setPlan]);

  const weekActions = useWeekPlanTasks({
    plan: currentWeekPlan,
    setPlan,
    createPlan,
  });

  /* ── timer ────────────────────────────────────────── */
  const chooseProject = (projectId) => {
    const p = projects.find((x) => String(x._id) === projectId);
    const next = p ? { projectId: String(p._id), title: p.name } : { projectId: "", title: "" };
    setActiveProject(next);
    setActiveTask(""); // tasks belong to a project
    try {
      localStorage.setItem("activeProject", JSON.stringify(next));
    } catch {}
  };

  const handleSessionCompletion = useCallback(
    async (focus, brk) => {
      const label = activeProject.title || NO_PROJECT_LABEL;
      try {
        await apiJson("/api/sessions", {
          method: "POST",
          body: JSON.stringify({
            focusTime: focus,
            breakTime: brk,
            currentProject: { title: label },
            tasks: activeTask
              ? [{ task: activeTask, completed: false, brand: { title: label } }]
              : [],
          }),
        });
        const on = activeTask ? `${activeTask} · ${label}` : label;
        toast.success(`Saved a ${focus}-minute session on ${on}.`);
        showNotification("🎯 Session Completed!", {
          body: `Great work! You completed a ${focus}-minute focus session on ${on}.`,
          icon: "/favicon.ico",
        });
        refreshSessions();
      } catch (e) {
        console.error("Error saving session", e);
        toast.error("Could not save the session.");
      }
    },
    [activeProject, activeTask, refreshSessions],
  );

  const navigate = useCallback(
    (key) => router.push(ROUTES[key] || "/planner"),
    [router],
  );

  if (!hasMounted || !user) return null;

  // Optional project + task row under the timer controls, inside the panel.
  const activeProjectId = activeProject.projectId;
  const taskGroups = activeProjectId
    ? [
        {
          key: "todo",
          label: "Tasks",
          options: tasks
            .filter(
              (t) =>
                !t.completed && String(idOf(t.project)) === String(activeProjectId),
            )
            .map((t) => ({ value: t.title, label: t.title })),
        },
        {
          key: "routine",
          label: "Routines",
          options: routineTasks
            .filter(
              (rt) => String(idOf(rt.project)) === String(activeProjectId),
            )
            .map((rt) => ({
              value: rt.title,
              label: rt.title,
              color: rt.color || undefined,
              hint: rt.estimatedTime ? `${rt.estimatedTime} min` : undefined,
            })),
        },
      ]
    : [];

  const projectPicker = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Dropdown
        id="dashboard-project"
        label="Project"
        value={activeProjectId}
        options={[
          { value: "", label: "No project" },
          ...projectOptions(projects),
        ]}
        onChange={chooseProject}
        placeholder="Optional"
        tone="primary"
        align="center"
        menuLabel="Project"
      />
      {activeProjectId ? (
        <Dropdown
          id="dashboard-task"
          label="Task"
          value={activeTask}
          groups={taskGroups}
          onChange={(v) => setActiveTask(v)}
          placeholder="Optional"
          tone="accent"
          align="center"
          menuLabel="Task"
          custom={{ type: "text", label: "Custom", placeholder: "Task name" }}
        />
      ) : null}
    </div>
  );

  const timerSlot = (
    <TimerControls
      handleSessionCompletion={handleSessionCompletion}
      showNotification={showNotification}
      extra={projectPicker}
    />
  );

  // Today's column of the week calendar, with the same add / drag flow.
  // Expanded, it also shows the next two days — clamped to the end of the
  // week, since this calendar holds one week's plan.
  const todayDow = (new Date().getDay() + 6) % 7;
  const visibleDays = Array.from(
    { length: calendarExpanded ? CALENDAR_EXPANDED_DAYS : 1 },
    (_, i) => todayDow + i,
  ).filter((d) => d <= 6);
  const canExpandCalendar = todayDow < 6;
  const dayTasks = Array.from({ length: 7 }, (_, d) =>
    visibleDays.includes(d)
      ? dayTasksForPlan({
          weekPlan: currentWeekPlan,
          routineTasks,
          tasks,
          dayIdx: d,
        })
      : [],
  );
  const mondayDate = new Date(monday + "T00:00:00");
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const projectNames = Object.fromEntries(
    projects.map((p) => [String(p._id), p.name]),
  );
  const projectColors = Object.fromEntries(
    projects.map((p) => [
      String(p._id),
      getProjectColorMeta(p.headerColor).swatchClass,
    ]),
  );
  const todaySlot = (
    <WeekCalendar
      weekPlan={currentWeekPlan || { weekStart: monday, days: [] }}
      dayTasks={dayTasks}
      dayDates={dayDates}
      todayDow={todayDow}
      routineTasks={routineTasks}
      todoTasks={tasks.filter((t) => !t.completed)}
      projectNameMap={projectNames}
      projectColorMap={projectColors}
      taskColorMap={routineColorMap(routineTasks)}
      getTaskProjectId={makeProjectResolver(routineTasks)}
      onAddTask={weekActions.addTask}
      onToggleTask={weekActions.toggleTask}
      onDeleteTask={weekActions.deleteTask}
      onUpdateTask={weekActions.updateTask}
      onMoveTask={weekActions.moveTask}
      visibleDays={visibleDays}
      compact
    />
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
          todaySlot={todaySlot}
          calendarExpanded={calendarExpanded}
          calendarDayCount={visibleDays.length}
          canExpandCalendar={canExpandCalendar}
          onToggleCalendar={toggleCalendar}
          onNavigate={navigate}
        />
      </main>
    </div>
  );
}
