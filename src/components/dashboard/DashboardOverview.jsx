"use client";

// Dashboard overview: one page that summarises every feature (timer,
// analytics, tasks, today's calendar, this week's schedule, habits, routines)
// with a shortcut into each one. Pure presentation: the page passes the data
// in and receives navigation requests through `onNavigate(key)`.

import React, { useMemo, useState } from "react";
import { toYMD } from "@/utils/timeUtils";
import {
  minutesToTime,
  taskDuration,
  formatMinutes,
} from "@/components/weekplan/WeekPlanShared";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/* ── Icons ─────────────────────────────────────────────── */

const icon = (path, extra = null) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
        {extra}
      </svg>
    );
  };

const IconTimer = icon(
  "M12 9v4l2.5 2.5M12 5V3M10 3h4",
  <circle cx="12" cy="13" r="8" />,
);
const IconAnalytics = icon("M4 19V10M10 19V4M16 19v-7M22 19H2");
const IconTasks = icon(
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
);
const IconCalendar = icon(
  "M3 10h18M8 3v4M16 3v4",
  <rect x="3" y="5" width="18" height="16" rx="2" />,
);
const IconSchedule = icon("M4 6h16M4 12h16M4 18h10");
const IconHabits = icon("M5 13l4 4L19 7");
const IconRoutines = icon(
  "M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 6.3L4 9m0 6a8 8 0 0013.7 2.7L20 15",
);
const IconArrow = icon("M5 12h14M13 6l6 6-6 6");
const IconClock = icon("M12 8v4l3 2", <circle cx="12" cy="12" r="9" />);

/* ── Building blocks ───────────────────────────────────── */

function SectionCard({
  title,
  subtitle,
  Icon,
  actionLabel,
  onAction,
  children,
  className = "",
}) {
  return (
    <section
      className={`bg-surface border border-edge rounded-2xl shadow-sm flex flex-col min-h-[220px] ${className}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-edge">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg leading-tight">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-[11px] text-fg-subtle truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-primary border border-edge hover:bg-primary-soft transition-colors"
        >
          {actionLabel}
          <IconArrow className="w-3.5 h-3.5" />
        </button>
      </header>
      <div className="flex-1 px-4 py-3">{children}</div>
    </section>
  );
}

function StatTile({ label, value, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-edge rounded-2xl px-4 py-3 shadow-sm hover:border-edge-strong transition-colors"
    >
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-fg leading-none">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-fg-muted">{hint}</div> : null}
    </button>
  );
}

function EmptyHint({ children, actionLabel, onAction }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-4">
      <p className="text-xs text-fg-subtle max-w-[240px]">{children}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ProgressBar({ pct, tone = "bg-primary" }) {
  return (
    <div className="h-1.5 w-full bg-edge rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

const idOf = (v) =>
  v == null ? null : typeof v === "object" ? String(v._id || v) : String(v);

const hoursLabel = (minutes) =>
  minutes ? `${(minutes / 60).toFixed(1)}h` : "0h";

/* ── Dashboard ─────────────────────────────────────────── */

export default function DashboardOverview({
  user,
  loaded = true,
  projects = [],
  tasks = [],
  habits = [],
  entries = [],
  weekPlan = null,
  routineTasks = [],
  sessions = [],
  palettes = {},
  timerSlot = null,
  onNavigate,
}) {
  const go = (key) => () => onNavigate?.(key);

  // Fixed for the life of the dashboard so derived data stays stable.
  const [now] = useState(() => new Date());
  const todayYMD = toYMD(now);
  const todayDow = (now.getDay() + 6) % 7; // 0 = Monday
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "").split(" ")[0];
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const projectName = useMemo(() => {
    const m = {};
    for (const p of projects) m[String(p._id)] = p.name;
    return m;
  }, [projects]);

  /* Sessions → analytics */
  const analytics = useMemo(() => {
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - todayDow);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const days = Array.from({ length: 7 }, (_, d) => ({
      d,
      minutes: 0,
      sessions: 0,
    }));
    let weekMinutes = 0;
    let weekSessions = 0;
    let todayMinutes = 0;
    let todaySessions = 0;
    let monthMinutes = 0;
    let monthSessions = 0;
    let totalMinutes = 0;
    for (const s of sessions) {
      const d = new Date(s.date);
      if (Number.isNaN(d.getTime())) continue;
      const m = Number(s.focusTime) || 0;
      totalMinutes += m;
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      ) {
        monthMinutes += m;
        monthSessions += 1;
      }
      if (d >= monday && d < nextMonday) {
        const i = (d.getDay() + 6) % 7;
        days[i].minutes += m;
        days[i].sessions += 1;
        weekMinutes += m;
        weekSessions += 1;
        if (toYMD(d) === todayYMD) {
          todayMinutes += m;
          todaySessions += 1;
        }
      }
    }
    const max = Math.max(...days.map((x) => x.minutes), 1);
    return {
      days,
      max,
      weekMinutes,
      weekSessions,
      todayMinutes,
      todaySessions,
      monthMinutes,
      monthSessions,
      totalMinutes,
      totalSessions: sessions.length,
    };
  }, [sessions, now, todayDow, todayYMD]);

  /* Tasks */
  const taskSummary = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed && !t.parentTask);
    const byProject = new Map();
    for (const t of pending) {
      const pid = idOf(t.project) || "none";
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid).push(t);
    }
    const groups = [...byProject.entries()]
      .map(([pid, list]) => ({
        pid,
        name: projectName[pid] || "Other",
        tasks: list,
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length);
    const doneTotal = tasks.filter((t) => t.completed && !t.parentTask).length;
    const later = pending.filter((t) => t.scheduledForLater).length;
    return { pending, groups, doneTotal, later };
  }, [tasks, projectName]);

  /* Today (calendar) + week (schedule) */
  const weekSummary = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, d) => {
      const list = weekPlan?.days?.find((x) => x.dayOfWeek === d)?.tasks || [];
      const done = list.filter((t) => t.completed).length;
      const minutes = list.reduce((s, t) => s + (t.estimatedTime || 0), 0);
      return { d, total: list.length, done, minutes, tasks: list };
    });
    const total = days.reduce((s, x) => s + x.total, 0);
    const done = days.reduce((s, x) => s + x.done, 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const today = days[todayDow];
    const timed = today.tasks
      .filter((t) => t.startMinute != null)
      .map((t) => ({
        task: t,
        start: Number(t.startMinute),
        end: Math.min(1440, Number(t.startMinute) + taskDuration(t)),
      }))
      .sort((a, b) => a.start - b.start);
    const untimed = today.tasks.filter((t) => t.startMinute == null);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const next = timed.find((b) => b.end > nowMin && !b.task.completed);
    return { days, total, done, pct, today, timed, untimed, next, nowMin };
  }, [weekPlan, todayDow, now]);

  /* Habits */
  const habitSummary = useMemo(() => {
    const byHabit = new Map();
    for (const e of entries) {
      const hid = idOf(e.habit);
      if (!byHabit.has(hid)) byHabit.set(hid, {});
      byHabit.get(hid)[e.date] = e.level || 0;
    }
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return toYMD(d);
    });
    const rows = habits.map((h) => {
      const map = byHabit.get(String(h._id)) || {};
      const week = last7.map((ymd) => ({ ymd, level: map[ymd] || 0 }));
      let streak = 0;
      for (let i = 0; i < 366; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if ((map[toYMD(d)] || 0) > 0) streak++;
        else if (i > 0 || streak > 0) break;
        // today not logged yet doesn't break the streak
      }
      return {
        habit: h,
        week,
        doneToday: (map[todayYMD] || 0) > 0,
        weekCount: week.filter((x) => x.level > 0).length,
        streak,
        swatch: palettes[h.color]?.swatch || "bg-primary",
      };
    });
    const doneToday = rows.filter((r) => r.doneToday).length;
    return { rows, doneToday, last7 };
  }, [habits, entries, todayYMD, palettes, now]);

  /* Routines */
  const routineSummary = useMemo(() => {
    const todayKey = DAY_KEYS[todayDow];
    const freqsOf = (rt) =>
      Array.isArray(rt.frequencies) && rt.frequencies.length
        ? rt.frequencies
        : rt.frequency
          ? [rt.frequency]
          : [];
    const today = routineTasks.filter((rt) => {
      const f = freqsOf(rt);
      return f.includes("daily") || f.includes(todayKey);
    });
    const byProject = new Map();
    for (const rt of routineTasks) {
      const pid = idOf(rt.project) || "none";
      byProject.set(pid, (byProject.get(pid) || 0) + 1);
    }
    const groups = [...byProject.entries()]
      .map(([pid, count]) => ({ pid, name: projectName[pid] || "Other", count }))
      .sort((a, b) => b.count - a.count);
    const auto = routineTasks.filter((rt) => rt.autoSchedule).length;
    const todayMinutes = today.reduce((s, rt) => s + (rt.estimatedTime || 0), 0);
    return { today, groups, auto, todayMinutes };
  }, [routineTasks, projectName, todayDow]);

  const nextLabel = weekSummary.next
    ? `${minutesToTime(weekSummary.next.start)} · ${weekSummary.next.task.taskName}`
    : weekSummary.timed.length
      ? "All blocks done for today"
      : "Nothing scheduled yet";

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-fg leading-tight">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="text-sm text-fg-muted">{dateLabel}</p>
          </div>
          <p className="text-xs text-fg-subtle flex items-center gap-1.5">
            <IconClock className="w-3.5 h-3.5" />
            {loaded ? (
              <>
                Up next: <span className="text-fg-muted">{nextLabel}</span>
              </>
            ) : (
              "Loading your day…"
            )}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatTile
            label="Focus today"
            value={hoursLabel(analytics.todayMinutes)}
            hint={`${analytics.todaySessions} session${analytics.todaySessions === 1 ? "" : "s"}`}
            onClick={go("timer")}
          />
          <StatTile
            label="Focus this week"
            value={hoursLabel(analytics.weekMinutes)}
            hint={`${analytics.weekSessions} session${analytics.weekSessions === 1 ? "" : "s"}`}
            onClick={go("analytics")}
          />
          <StatTile
            label="Pending tasks"
            value={taskSummary.pending.length}
            hint={
              taskSummary.later
                ? `${taskSummary.later} scheduled for later`
                : `${taskSummary.doneTotal} completed`
            }
            onClick={go("tasks")}
          />
          <StatTile
            label="Today's blocks"
            value={weekSummary.timed.length}
            hint={
              weekSummary.untimed.length
                ? `${weekSummary.untimed.length} without a time yet`
                : "Everything has a time"
            }
            onClick={go("calendar")}
          />
          <StatTile
            label="Week progress"
            value={`${weekSummary.pct}%`}
            hint={`${weekSummary.done} of ${weekSummary.total} tasks done`}
            onClick={go("schedule")}
          />
          <StatTile
            label="Habits today"
            value={`${habitSummary.doneToday}/${habits.length}`}
            hint={habits.length ? "logged so far" : "no habits yet"}
            onClick={go("habits")}
          />
        </div>

        {/* Timer + analytics */}
        <div className="grid md:grid-cols-3 gap-4">
          <SectionCard
            title="Timer"
            subtitle={
              analytics.todaySessions
                ? `${analytics.todaySessions} session${analytics.todaySessions === 1 ? "" : "s"} today · ${formatMinutes(analytics.todayMinutes)} focused`
                : "Start a focus session right here"
            }
            Icon={IconTimer}
            actionLabel="Open Timer"
            onAction={go("timer")}
            className="md:col-span-2"
          >
            {timerSlot || (
              <EmptyHint actionLabel="Open Timer" onAction={go("timer")}>
                Run focused sessions and keep your streak going.
              </EmptyHint>
            )}
          </SectionCard>

          <SectionCard
            title="Analytics"
            subtitle="Focus hours this week"
            Icon={IconAnalytics}
            actionLabel="Open Analytics"
            onAction={go("analytics")}
          >
            {analytics.totalSessions ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1.5 items-end">
                  {analytics.days.map((d) => {
                    const pct = (d.minutes / analytics.max) * 100;
                    const isToday = d.d === todayDow;
                    return (
                      <div
                        key={d.d}
                        className="text-center"
                        title={`${DAY_SHORT[d.d]}: ${formatMinutes(d.minutes)} in ${d.sessions} session${d.sessions === 1 ? "" : "s"}`}
                      >
                        <div className="h-16 rounded-md bg-surface-2 border border-edge relative overflow-hidden">
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${
                              isToday ? "bg-accent" : "bg-chart-1"
                            } ${d.minutes ? "" : "opacity-0"}`}
                            style={{ height: `${Math.max(pct, d.minutes ? 6 : 0)}%` }}
                          />
                        </div>
                        <div
                          className={`mt-1 text-[10px] font-semibold ${
                            isToday ? "text-primary" : "text-fg-subtle"
                          }`}
                        >
                          {DAY_SHORT[d.d]}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-fg-subtle">
                      Week
                    </dt>
                    <dd className="text-sm font-semibold text-fg tabular-nums">
                      {hoursLabel(analytics.weekMinutes)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-fg-subtle">
                      Month
                    </dt>
                    <dd className="text-sm font-semibold text-fg tabular-nums">
                      {hoursLabel(analytics.monthMinutes)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-fg-subtle">
                      All time
                    </dt>
                    <dd className="text-sm font-semibold text-fg tabular-nums">
                      {analytics.totalSessions}
                      <span className="text-[10px] font-normal text-fg-subtle">
                        {" "}
                        sess.
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <EmptyHint actionLabel="Start a session" onAction={go("timer")}>
                Complete a focus session and your weekly, monthly and yearly
                charts will start filling up.
              </EmptyHint>
            )}
          </SectionCard>
        </div>

        {/* Planner sections */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Today / Calendar */}
          <SectionCard
            title="Today"
            subtitle={`${DAY_SHORT[todayDow]} · hour by hour`}
            Icon={IconCalendar}
            actionLabel="Open Calendar"
            onAction={go("calendar")}
          >
            {weekSummary.timed.length || weekSummary.untimed.length ? (
              <div className="space-y-1.5">
                {weekSummary.timed.map(({ task, start, end }) => {
                  const isNow =
                    weekSummary.nowMin >= start && weekSummary.nowMin < end;
                  return (
                    <div
                      key={task._id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                        task.completed
                          ? "bg-success-soft border-success/30 text-fg-subtle"
                          : isNow
                            ? "bg-accent-soft border-accent/40 text-fg"
                            : "bg-surface-2 border-edge text-fg"
                      }`}
                    >
                      <span className="tabular-nums text-fg-subtle shrink-0">
                        {minutesToTime(start)}–{minutesToTime(end)}
                      </span>
                      <span
                        className={`truncate flex-1 ${task.completed ? "line-through" : "font-medium"}`}
                      >
                        {task.taskName}
                      </span>
                      {isNow && !task.completed ? (
                        <span className="text-[10px] font-semibold text-accent shrink-0">
                          now
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {weekSummary.untimed.length ? (
                  <div className="pt-1 text-[11px] text-fg-subtle">
                    No time yet:{" "}
                    <span className="text-fg-muted">
                      {weekSummary.untimed
                        .slice(0, 3)
                        .map((t) => t.taskName)
                        .join(", ")}
                      {weekSummary.untimed.length > 3
                        ? ` +${weekSummary.untimed.length - 3} more`
                        : ""}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyHint actionLabel="Plan today" onAction={go("calendar")}>
                {weekPlan
                  ? "Nothing on today's calendar. Drag tasks onto an hour to plan your day."
                  : "Create a week plan to start placing tasks on the calendar."}
              </EmptyHint>
            )}
          </SectionCard>

          {/* This week / Schedule */}
          <SectionCard
            title="This week"
            subtitle={
              weekPlan
                ? `${weekPlan.name} · ${weekSummary.done}/${weekSummary.total} done`
                : "No week plan yet"
            }
            Icon={IconSchedule}
            actionLabel="Open Schedule"
            onAction={go("schedule")}
          >
            {weekPlan ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1.5">
                  {weekSummary.days.map((d) => {
                    const pct = d.total ? (d.done / d.total) * 100 : 0;
                    const isToday = d.d === todayDow;
                    return (
                      <div key={d.d} className="text-center">
                        <div
                          className={`text-[10px] font-semibold ${
                            isToday ? "text-primary" : "text-fg-subtle"
                          }`}
                        >
                          {DAY_SHORT[d.d]}
                        </div>
                        <div className="mt-1 h-14 rounded-md bg-surface-2 border border-edge relative overflow-hidden">
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${
                              pct === 100 ? "bg-success" : "bg-primary"
                            } ${d.total ? "" : "opacity-0"}`}
                            style={{ height: `${Math.max(pct, d.total ? 8 : 0)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-fg-muted tabular-nums">
                          {d.done}/{d.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-fg-muted mb-1">
                    <span>Overall</span>
                    <span className="tabular-nums">
                      {weekSummary.pct}% ·{" "}
                      {formatMinutes(
                        weekSummary.days.reduce((s, x) => s + x.minutes, 0),
                      )}{" "}
                      planned
                    </span>
                  </div>
                  <ProgressBar
                    pct={weekSummary.pct}
                    tone={weekSummary.pct === 100 ? "bg-success" : "bg-primary"}
                  />
                </div>
              </div>
            ) : (
              <EmptyHint actionLabel="Create a week" onAction={go("schedule")}>
                Plan your week by project and day, then check things off as you
                go.
              </EmptyHint>
            )}
          </SectionCard>

          {/* Tasks */}
          <SectionCard
            title="Tasks"
            subtitle={`${taskSummary.pending.length} pending across ${projects.length} project${projects.length === 1 ? "" : "s"}`}
            Icon={IconTasks}
            actionLabel="Open Tasks"
            onAction={go("tasks")}
          >
            {taskSummary.groups.length ? (
              <div className="space-y-3">
                {taskSummary.groups.slice(0, 3).map((g) => (
                  <div key={g.pid}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-fg-muted truncate">
                        {g.name}
                      </span>
                      <span className="text-fg-subtle tabular-nums">
                        {g.tasks.length}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {g.tasks.slice(0, 3).map((t) => (
                        <li
                          key={t._id}
                          className="flex items-center gap-2 text-xs text-fg"
                        >
                          <span className="w-3 h-3 rounded border border-edge shrink-0" />
                          <span className="truncate">{t.title}</span>
                          {t.scheduledDate ? (
                            <span className="ml-auto text-[10px] text-primary shrink-0">
                              {new Date(t.scheduledDate).toLocaleDateString(
                                undefined,
                                { day: "2-digit", month: "2-digit" },
                              )}
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {g.tasks.length > 3 ? (
                        <li className="text-[10px] text-fg-subtle pl-5">
                          +{g.tasks.length - 3} more
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ))}
                {taskSummary.groups.length > 3 ? (
                  <div className="text-[10px] text-fg-subtle">
                    +{taskSummary.groups.length - 3} more project
                    {taskSummary.groups.length - 3 === 1 ? "" : "s"}
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyHint actionLabel="Add a task" onAction={go("tasks")}>
                {projects.length
                  ? "All caught up. Nothing is pending."
                  : "Create a project and add your first tasks."}
              </EmptyHint>
            )}
          </SectionCard>

          {/* Habits */}
          <SectionCard
            title="Habits"
            subtitle="Last 7 days"
            Icon={IconHabits}
            actionLabel="Open Habits"
            onAction={go("habits")}
          >
            {habitSummary.rows.length ? (
              <div className="space-y-2">
                {habitSummary.rows.slice(0, 6).map((r) => (
                  <div key={r.habit._id} className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.swatch}`}
                    />
                    <span className="text-xs text-fg truncate flex-1 min-w-0">
                      {r.habit.name}
                    </span>
                    <span
                      className="flex items-center gap-0.5 shrink-0"
                      title={`${r.weekCount}/7 this week`}
                    >
                      {r.week.map((d) => (
                        <span
                          key={d.ymd}
                          className={`w-3 h-3 rounded-sm ${
                            d.level > 0
                              ? r.swatch
                              : "bg-surface-2 border border-edge"
                          } ${d.ymd === todayYMD ? "ring-1 ring-focus/60" : ""}`}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] text-fg-subtle tabular-nums w-9 text-right shrink-0">
                      {r.streak ? `${r.streak}d` : "–"}
                    </span>
                  </div>
                ))}
                {habitSummary.rows.length > 6 ? (
                  <div className="text-[10px] text-fg-subtle">
                    +{habitSummary.rows.length - 6} more
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyHint actionLabel="Create a habit" onAction={go("habits")}>
                Track daily habits and watch your year fill up.
              </EmptyHint>
            )}
          </SectionCard>

          {/* Routines */}
          <SectionCard
            title="Routines"
            subtitle={`${routineTasks.length} routine task${routineTasks.length === 1 ? "" : "s"} · ${routineSummary.auto} auto-scheduled`}
            Icon={IconRoutines}
            actionLabel="Open Routines"
            onAction={go("routines")}
            className="md:col-span-2 xl:col-span-2"
          >
            {routineTasks.length ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-fg-muted mb-1.5">
                    Due today
                    {routineSummary.todayMinutes ? (
                      <span className="font-normal text-fg-subtle">
                        {" "}
                        · {formatMinutes(routineSummary.todayMinutes)}
                      </span>
                    ) : null}
                  </div>
                  {routineSummary.today.length ? (
                    <ul className="space-y-1">
                      {routineSummary.today.slice(0, 5).map((rt) => (
                        <li
                          key={rt._id}
                          className="flex items-center gap-2 text-xs text-fg"
                        >
                          <span
                            className="w-1.5 h-4 rounded-full shrink-0"
                            style={{
                              backgroundColor: rt.color || "var(--border-strong)",
                            }}
                          />
                          <span className="truncate flex-1">{rt.title}</span>
                          {rt.estimatedTime ? (
                            <span className="text-[10px] text-fg-subtle tabular-nums shrink-0">
                              {rt.estimatedTime}m
                            </span>
                          ) : null}
                          {rt.autoSchedule ? (
                            <span
                              className="text-[10px] px-1 rounded bg-warning-soft text-warning shrink-0"
                              title="Auto-scheduled"
                            >
                              auto
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {routineSummary.today.length > 5 ? (
                        <li className="text-[10px] text-fg-subtle">
                          +{routineSummary.today.length - 5} more
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="text-xs text-fg-subtle">
                      No routines fall on {DAY_SHORT[todayDow]}.
                    </p>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-fg-muted mb-1.5">
                    By project
                  </div>
                  <ul className="space-y-1.5">
                    {routineSummary.groups.slice(0, 5).map((g) => {
                      const pct = routineTasks.length
                        ? (g.count / routineTasks.length) * 100
                        : 0;
                      return (
                        <li key={g.pid}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-fg truncate">{g.name}</span>
                            <span className="text-fg-subtle tabular-nums">
                              {g.count}
                            </span>
                          </div>
                          <ProgressBar pct={pct} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <EmptyHint actionLabel="Add a routine" onAction={go("routines")}>
                Routine tasks repeat on the days you choose and can auto-fill
                your schedule.
              </EmptyHint>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
