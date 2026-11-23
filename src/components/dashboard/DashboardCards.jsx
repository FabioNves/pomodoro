"use client";

// The dashboard's working cards: Tasks (tick a task off, put it on the
// calendar at a time, unfold every project and task) and Habits (click a day
// to log it). The page owns the data and saving (onToggleTask,
// onScheduleTask, onSetHabitLevel); these only draw and ask.

import React, { useMemo, useRef, useState } from "react";
import TimerPopover, { MicroLabel } from "@/components/timer/TimerPopover";
import { getProjectColorMeta } from "@/lib/projectColors";
import { levelShadeClass } from "@/lib/habitPalettes";
import { idOf } from "@/lib/weekPlanView";

const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const toMinutes = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** The local calendar day a stored scheduledDate stands for (as the calendar reads it). */
function scheduledDay(task) {
  if (!task.scheduledDate) return null;
  const d = new Date(task.scheduledDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function dayWord(date, today) {
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

const IconCheck = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.09l6.79-6.8a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);
const IconClock = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
const IconChevron = ({ open }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

/* ── putting a task on the calendar ────────────────────── */

const LENGTHS = [15, 30, 45, 60, 90, 120];
const lengthLabel = (m) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`);

function SchedulePanel({ task, onSave, onClear, onClose }) {
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const current = scheduledDay(task);
  const [date, setDate] = useState(ymdOf(current || today));
  const nextQuarter = () => {
    const now = new Date();
    return Math.min(23 * 60 + 45, Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 15) * 15);
  };
  const [time, setTime] = useState(clock(Number.isInteger(task.startMinute) ? task.startMinute : nextQuarter()));
  const [length, setLength] = useState(task.durationMinutes || 30);
  const start = toMinutes(time);
  const chip = (on) =>
    `h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors ${
      on ? "border-primary bg-primary-soft text-fg" : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
    }`;

  return (
    <div className="w-[19rem] p-3.5 space-y-3.5">
      <div>
        <MicroLabel>Put on the calendar</MicroLabel>
        <p className="mt-0.5 text-sm font-semibold text-fg truncate" title={task.title}>{task.title}</p>
      </div>
      <div>
        <MicroLabel className="mb-1.5">Day</MicroLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={chip(date === ymdOf(today))} onClick={() => setDate(ymdOf(today))}>Today</button>
          <button type="button" className={chip(date === ymdOf(tomorrow))} onClick={() => setDate(ymdOf(tomorrow))}>Tomorrow</button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Another day"
            className="h-8 px-2 rounded-lg border border-edge bg-surface-2/60 text-xs text-fg outline-none focus:border-focus [color-scheme:dark] dark:[color-scheme:dark]"
          />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <label className="block">
          <MicroLabel className="mb-1.5">Start</MicroLabel>
          <input
            type="time"
            step={900}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 px-2 rounded-lg border border-edge bg-surface-2/60 text-sm font-semibold tabular-nums text-fg outline-none focus:border-focus [color-scheme:dark]"
          />
        </label>
        {start != null ? <span className="pb-1.5 text-xs text-fg-subtle tabular-nums">to {clock(start + length)}</span> : null}
      </div>
      <div>
        <MicroLabel className="mb-1.5">Length</MicroLabel>
        <div className="flex flex-wrap gap-1.5">
          {LENGTHS.map((m) => (
            <button key={m} type="button" className={chip(length === m)} onClick={() => setLength(m)}>
              {lengthLabel(m)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {current && Number.isInteger(task.startMinute) ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="h-9 px-3 rounded-full text-xs font-semibold text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors"
          >
            Remove time
          </button>
        ) : null}
        <button
          type="button"
          disabled={start == null}
          onClick={() => {
            onSave({ date, startMinute: start, durationMinutes: length });
            onClose();
          }}
          className="ml-auto h-9 px-4 rounded-full bg-primary hover:bg-primary-hover text-primary-fg text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onSchedule, today }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const day = scheduledDay(task);
  const when = day
    ? `${dayWord(day, today)}${Number.isInteger(task.startMinute) ? ` ${clock(task.startMinute)}` : ""}`
    : "";
  return (
    <li className="group flex items-center gap-2 min-h-[1.75rem] text-sm">
      <button
        type="button"
        role="checkbox"
        aria-checked={!!task.completed}
        aria-label={task.completed ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        onClick={() => onToggle(task)}
        className={`w-4 h-4 grid place-items-center rounded border shrink-0 transition-colors ${
          task.completed ? "bg-success border-success text-white" : "border-edge-strong hover:border-primary hover:bg-primary-soft text-transparent"
        }`}
      >
        <IconCheck />
      </button>
      <span className={`flex-1 min-w-0 truncate ${task.completed ? "line-through text-fg-subtle" : "text-fg"}`} title={task.title}>
        {task.title}
      </span>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={when ? `${task.title}: ${when}. Change the time` : `Put “${task.title}” on the calendar`}
        title={when ? "Change the time" : "Put on the calendar"}
        className={`shrink-0 inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] tabular-nums transition-colors ${
          when
            ? "text-primary bg-primary-soft/60 hover:bg-primary-soft"
            : `text-fg-subtle hover:text-primary hover:bg-primary-soft ${open ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"}`
        }`}
      >
        <IconClock className="w-3 h-3" />
        {when || null}
      </button>
      {open ? (
        <TimerPopover anchorRef={ref} open onClose={() => setOpen(false)} align="end" label="Put on the calendar">
          <SchedulePanel
            task={task}
            onSave={(placement) => onSchedule(task, placement)}
            onClear={() => onSchedule(task, null)}
            onClose={() => setOpen(false)}
          />
        </TimerPopover>
      ) : null}
    </li>
  );
}

const TASKS_SHOWN = 5;
const PROJECTS_SHOWN = 6;

/** Pending tasks by project, as many columns as fit. */
export function TasksCardBody({ tasks, projects, onToggle, onSchedule, empty }) {
  // Ticked here stays on screen (struck through) so it can be unticked.
  const [ticked, setTicked] = useState(() => new Set());
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [allProjects, setAllProjects] = useState(false);
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const groups = useMemo(() => {
    const byProject = new Map();
    for (const t of tasks) {
      if (t.parentTask) continue;
      if (t.completed && !ticked.has(String(t._id))) continue;
      const pid = idOf(t.project) || "none";
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid).push(t);
    }
    return [...byProject.entries()]
      .map(([pid, list]) => {
        const p = projects.find((x) => String(x._id) === pid);
        return {
          pid,
          name: p?.name || "No project",
          swatch: p ? getProjectColorMeta(p.headerColor).swatchClass : "bg-edge-strong",
          tasks: list,
          pending: list.filter((t) => !t.completed).length,
        };
      })
      .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  }, [tasks, projects, ticked]);

  if (!groups.length) return empty;

  const toggle = (task) => {
    const id = String(task._id);
    if (!task.completed) setTicked((s) => new Set(s).add(id));
    onToggle(task);
  };
  const shownGroups = allProjects ? groups : groups.slice(0, PROJECTS_SHOWN);

  return (
    <div className="space-y-3">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {shownGroups.map((g) => {
          const open = openGroups.has(g.pid);
          const list = open ? g.tasks : g.tasks.slice(0, TASKS_SHOWN);
          const hidden = g.tasks.length - list.length;
          return (
            <section key={g.pid} className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${g.swatch}`} aria-hidden="true" />
                <span className="text-xs font-semibold text-fg-muted truncate flex-1">{g.name}</span>
                <span className="text-[11px] text-fg-subtle tabular-nums">{g.pending}</span>
              </div>
              <ul className="space-y-0.5">
                {list.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={toggle} onSchedule={onSchedule} today={today} />
                ))}
              </ul>
              {hidden > 0 || open ? (
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((s) => {
                      const next = new Set(s);
                      if (next.has(g.pid)) next.delete(g.pid);
                      else next.add(g.pid);
                      return next;
                    })
                  }
                  aria-expanded={open}
                  className="mt-1 ml-6 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline underline-offset-2"
                >
                  {open ? "Show less" : `+${hidden} more`}
                  <IconChevron open={open} />
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
      {groups.length > PROJECTS_SHOWN ? (
        <button
          type="button"
          onClick={() => setAllProjects((v) => !v)}
          aria-expanded={allProjects}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
        >
          {allProjects ? "Fewer projects" : `+${groups.length - PROJECTS_SHOWN} more project${groups.length - PROJECTS_SHOWN === 1 ? "" : "s"}`}
          <IconChevron open={allProjects} />
        </button>
      ) : null}
    </div>
  );
}

/* ── habits ────────────────────────────────────────────── */

function LevelMenu({ habit, date, value, maxLevel, onPick }) {
  const levels = [...(habit.levels || [])].sort((a, b) => a.value - b.value);
  const row = (on) =>
    `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors ${on ? "bg-surface-2 text-fg font-medium" : "text-fg-muted hover:bg-surface-hover hover:text-fg"}`;
  return (
    <div className="w-48 p-1.5">
      <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-fg-subtle">
        {habit.name} · {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
      </p>
      <button type="button" className={row(!value)} onClick={() => onPick(0)}>
        <span className="w-3 h-3 rounded-sm bg-surface-2 border border-edge" aria-hidden="true" /> None
      </button>
      {levels.map((l) => (
        <button key={l.value} type="button" className={row(value === l.value)} onClick={() => onPick(l.value)}>
          <span className={`w-3 h-3 rounded-sm ${levelShadeClass(l, habit.color, maxLevel)}`} aria-hidden="true" /> {l.label}
        </button>
      ))}
    </div>
  );
}

function DaySquare({ row, day, isToday, onSetLevel }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const habit = row.habit;
  const levels = habit.levels || [];
  const maxLevel = Math.max(...levels.map((l) => l.value), 1);
  const level = levels.find((l) => l.value === day.level);
  const label = new Date(`${day.ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  // One level (or none defined): a click logs or clears. More: pick one.
  const simple = levels.length <= 1;
  const onClick = () => {
    if (simple) onSetLevel(habit._id, day.ymd, day.level ? 0 : levels[0]?.value || 1);
    else setOpen((o) => !o);
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-haspopup={simple ? undefined : "dialog"}
        aria-expanded={simple ? undefined : open}
        aria-label={`${habit.name}, ${label}: ${level?.label || (day.level ? "done" : "not logged")}`}
        title={`${label}${level ? ` · ${level.label}` : day.level ? " · done" : ""}`}
        className={`w-5 h-5 rounded-[5px] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 ${
          day.level > 0 ? (level ? levelShadeClass(level, habit.color, maxLevel) : row.swatch) : "bg-surface-2 border border-edge hover:border-edge-strong"
        } ${isToday ? "ring-1 ring-offset-1 ring-offset-surface ring-focus/70" : ""}`}
      />
      {open ? (
        <TimerPopover anchorRef={ref} open onClose={() => setOpen(false)} align="center" label={`${habit.name} on ${label}`}>
          <LevelMenu
            habit={habit}
            date={day.ymd}
            value={day.level}
            maxLevel={maxLevel}
            onPick={(value) => {
              onSetLevel(habit._id, day.ymd, value);
              setOpen(false);
            }}
          />
        </TimerPopover>
      ) : null}
    </>
  );
}

const HABITS_SHOWN = 6;

/** Each habit's last seven days, clickable. */
export function HabitsCardBody({ rows, todayYMD, onSetLevel, empty }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return empty;
  const shown = all ? rows : rows.slice(0, HABITS_SHOWN);
  const days = rows[0].week;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pl-[1.125rem]">
        <span className="flex-1" />
        <span className="flex items-center gap-1 shrink-0" aria-hidden="true">
          {days.map((d) => (
            <span key={d.ymd} className={`w-5 text-center text-[9px] font-semibold uppercase ${d.ymd === todayYMD ? "text-primary" : "text-fg-subtle"}`}>
              {new Date(`${d.ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          ))}
        </span>
        <span className="w-9 shrink-0" />
      </div>
      {shown.map((r) => (
        <div key={r.habit._id} className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.swatch}`} aria-hidden="true" />
          <span className="text-xs text-fg truncate flex-1 min-w-0" title={r.habit.name}>{r.habit.name}</span>
          <span className="flex items-center gap-1 shrink-0">
            {r.week.map((d) => (
              <DaySquare key={d.ymd} row={r} day={d} isToday={d.ymd === todayYMD} onSetLevel={onSetLevel} />
            ))}
          </span>
          <span className="text-[10px] text-fg-subtle tabular-nums w-9 text-right shrink-0" title="Current streak">
            {r.streak ? `${r.streak}d` : "–"}
          </span>
        </div>
      ))}
      {rows.length > HABITS_SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline underline-offset-2"
        >
          {all ? "Show less" : `+${rows.length - HABITS_SHOWN} more`}
          <IconChevron open={all} />
        </button>
      ) : null}
    </div>
  );
}
