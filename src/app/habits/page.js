"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { generateSessionId } from "@/utils/sessionUtils";

/* ── helpers ───────────────────────────────────────────── */

function getIdentityHeaders() {
  if (typeof window === "undefined") return {};
  const userId = localStorage.getItem("userId");
  if (userId) return { "user-id": userId };
  return { "session-id": generateSessionId() };
}

async function apiJson(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getIdentityHeaders(),
    "Content-Type": "application/json",
  };
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── color palettes (5 intensity levels per color) ───── */

const COLOR_PALETTES = {
  blue: {
    label: "Blue",
    swatch: "bg-blue-500",
    shades: [
      "bg-blue-100 dark:bg-blue-900/40",
      "bg-blue-200 dark:bg-blue-800/50",
      "bg-blue-400 dark:bg-blue-600/70",
      "bg-blue-500 dark:bg-blue-500",
      "bg-blue-700 dark:bg-blue-400",
    ],
  },
  green: {
    label: "Green",
    swatch: "bg-green-500",
    shades: [
      "bg-green-100 dark:bg-green-900/40",
      "bg-green-200 dark:bg-green-800/50",
      "bg-green-400 dark:bg-green-600/70",
      "bg-green-500 dark:bg-green-500",
      "bg-green-700 dark:bg-green-400",
    ],
  },
  red: {
    label: "Red",
    swatch: "bg-red-500",
    shades: [
      "bg-red-100 dark:bg-red-900/40",
      "bg-red-200 dark:bg-red-800/50",
      "bg-red-400 dark:bg-red-600/70",
      "bg-red-500 dark:bg-red-500",
      "bg-red-700 dark:bg-red-400",
    ],
  },
  orange: {
    label: "Orange",
    swatch: "bg-orange-500",
    shades: [
      "bg-orange-100 dark:bg-orange-900/40",
      "bg-orange-200 dark:bg-orange-800/50",
      "bg-orange-400 dark:bg-orange-600/70",
      "bg-orange-500 dark:bg-orange-500",
      "bg-orange-700 dark:bg-orange-400",
    ],
  },
  purple: {
    label: "Purple",
    swatch: "bg-purple-500",
    shades: [
      "bg-purple-100 dark:bg-purple-900/40",
      "bg-purple-200 dark:bg-purple-800/50",
      "bg-purple-400 dark:bg-purple-600/70",
      "bg-purple-500 dark:bg-purple-500",
      "bg-purple-700 dark:bg-purple-400",
    ],
  },
  yellow: {
    label: "Yellow",
    swatch: "bg-yellow-500",
    shades: [
      "bg-yellow-100 dark:bg-yellow-900/40",
      "bg-yellow-200 dark:bg-yellow-700/50",
      "bg-yellow-400 dark:bg-yellow-600/70",
      "bg-yellow-500 dark:bg-yellow-500",
      "bg-yellow-600 dark:bg-yellow-400",
    ],
  },
};

function getPalette(color) {
  return COLOR_PALETTES[color] || COLOR_PALETTES.blue;
}

function getShadeClass(color, level, maxLevel) {
  if (!level) return "bg-gray-100 dark:bg-gray-800/60";
  const palette = getPalette(color);
  const idx = Math.min(
    Math.round((level / maxLevel) * (palette.shades.length - 1)),
    palette.shades.length - 1,
  );
  return palette.shades[idx];
}

/* ── date helpers ──────────────────────────────────────── */

function getYearDays(year) {
  const days = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    days.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthLabels(year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      month: m,
    });
  }
  return months;
}

function getDayOfWeek(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay(); // 0=Sun
}

/* ── Icons ─────────────────────────────────────────────── */

function IconPlus({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconTrash({ className = "" }) {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function IconChevron({ open, className = "" }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.15 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

/* ── Yearly heatmap grid ───────────────────────────────── */

function YearHeatmap({ year, habit, entriesByDate, onDayClick, selectedDate }) {
  const days = useMemo(() => getYearDays(year), [year]);
  const monthLabels = useMemo(() => getMonthLabels(year), [year]);
  const maxLevel = useMemo(
    () => Math.max(...(habit.levels || []).map((l) => l.value), 1),
    [habit.levels],
  );

  // Build weeks (columns) — each column is 7 rows (Sun–Sat)
  const weeks = useMemo(() => {
    const result = [];
    let currentWeek = new Array(7).fill(null);
    const firstDow = getDayOfWeek(days[0]);

    // Offset for the first day
    for (let i = 0; i < days.length; i++) {
      const dow = getDayOfWeek(days[i]);
      if (dow === 0 && i > 0) {
        result.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
      currentWeek[dow] = days[i];
    }
    result.push(currentWeek);
    return result;
  }, [days]);

  // Which week index does each month start at?
  const monthPositions = useMemo(() => {
    const positions = [];
    let weekIdx = 0;
    for (const week of weeks) {
      for (const dateStr of week) {
        if (!dateStr) continue;
        const month = parseInt(dateStr.split("-")[1], 10) - 1;
        if (!positions[month] && positions[month] !== 0) {
          positions[month] = weekIdx;
        }
      }
      weekIdx++;
    }
    return positions;
  }, [weeks]);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        {/* Month labels */}
        <div className="flex ml-8">
          {monthLabels.map((m, idx) => {
            const left = (monthPositions[idx] || 0) * 13; // 11px square + 2px gap
            return (
              <div
                key={idx}
                className="text-[10px] text-gray-500 dark:text-gray-400 absolute"
                style={{
                  position: "relative",
                  left: 0,
                  width:
                    idx < 11
                      ? `${((monthPositions[idx + 1] || weeks.length) - (monthPositions[idx] || 0)) * 13}px`
                      : "auto",
                }}
              >
                {m.label}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex gap-0">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[2px] mr-1 pt-0">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="h-[11px] flex items-center text-[10px] text-gray-400 dark:text-gray-500 leading-none"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((dateStr, di) => {
                  if (!dateStr) {
                    return <div key={di} className="w-[11px] h-[11px]" />;
                  }
                  const entry = entriesByDate[dateStr];
                  const level = entry?.level || 0;
                  const shadeClass = getShadeClass(
                    habit.color,
                    level,
                    maxLevel,
                  );
                  const isSelected = selectedDate === dateStr;
                  const today = formatDate(new Date());
                  const isToday = dateStr === today;

                  return (
                    <button
                      key={di}
                      type="button"
                      className={`w-[11px] h-[11px] rounded-[2px] transition-all ${shadeClass} ${
                        isSelected
                          ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900"
                          : ""
                      } ${
                        isToday && !isSelected
                          ? "ring-1 ring-gray-400 dark:ring-gray-500"
                          : ""
                      } hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 dark:hover:ring-offset-gray-900`}
                      onClick={() => onDayClick(dateStr)}
                      title={`${dateStr}${level ? ` — ${habit.levels?.find((l) => l.value === level)?.label || `Level ${level}`}` : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 ml-8">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">
            Less
          </span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-gray-100 dark:bg-gray-800/60" />
          {(habit.levels || [])
            .sort((a, b) => a.value - b.value)
            .map((l, i) => (
              <div
                key={i}
                className={`w-[11px] h-[11px] rounded-[2px] ${getShadeClass(
                  habit.color,
                  l.value,
                  maxLevel,
                )}`}
                title={l.label}
              />
            ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
            More
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Level picker popover ──────────────────────────────── */

function LevelPicker({ habit, date, currentLevel, onSetLevel, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const maxLevel = Math.max(...(habit.levels || []).map((l) => l.value), 1);

  return (
    <motion.div
      ref={ref}
      className="absolute z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 min-w-[180px]"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        {date}
      </div>
      <div className="flex flex-col gap-1">
        {/* None option */}
        <button
          type="button"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            currentLevel === 0
              ? "bg-gray-100 dark:bg-gray-800 font-medium"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
          onClick={() => {
            onSetLevel(habit._id, date, 0);
            onClose();
          }}
        >
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-600" />
          None
        </button>

        {(habit.levels || [])
          .sort((a, b) => a.value - b.value)
          .map((l) => (
            <button
              key={l.value}
              type="button"
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                currentLevel === l.value
                  ? "bg-gray-100 dark:bg-gray-800 font-medium"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
              onClick={() => {
                onSetLevel(habit._id, date, l.value);
                onClose();
              }}
            >
              <div
                className={`w-3 h-3 rounded-sm ${getShadeClass(
                  habit.color,
                  l.value,
                  maxLevel,
                )}`}
              />
              {l.label}
            </button>
          ))}
      </div>
    </motion.div>
  );
}

/* ── Default level presets ─────────────────────────────── */

const DEFAULT_LEVELS = [
  { label: "10 min", value: 1 },
  { label: "30 min", value: 2 },
  { label: "1 hour", value: 3 },
  { label: "2 hours", value: 4 },
];

/* ── Create habit form ─────────────────────────────────── */

function CreateHabitForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [levels, setLevels] = useState(DEFAULT_LEVELS.map((l) => ({ ...l })));

  const addLevel = () => {
    if (levels.length >= 10) return;
    setLevels((prev) => [
      ...prev,
      {
        label: "",
        value: prev.length ? Math.max(...prev.map((l) => l.value)) + 1 : 1,
      },
    ]);
  };

  const removeLevel = (idx) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLevel = (idx, field, val) => {
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const validLevels = levels.filter((l) => l.label.trim());
    if (!validLevels.length) return;
    onSubmit({
      name: trimmed,
      color,
      levels: validLevels.map((l, i) => ({
        label: l.label.trim(),
        value: l.value || i + 1,
      })),
    });
  };

  return (
    <motion.div
      className="mt-3 bg-white/90 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name (e.g. Running)"
          className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />

        {/* Color picker */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            Color
          </div>
          <div className="flex gap-2">
            {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
              <button
                key={key}
                type="button"
                className={`w-6 h-6 rounded-full ${pal.swatch} transition-transform ${
                  color === key
                    ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900 scale-110"
                    : "hover:scale-110"
                }`}
                onClick={() => setColor(key)}
                aria-label={pal.label}
              />
            ))}
          </div>
        </div>

        {/* Levels */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            Intensity Levels
          </div>
          <div className="space-y-1.5">
            {levels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-sm shrink-0 ${getShadeClass(
                    color,
                    l.value,
                    Math.max(...levels.map((x) => x.value), 1),
                  )}`}
                />
                <input
                  value={l.label}
                  onChange={(e) => updateLevel(i, "label", e.target.value)}
                  placeholder={`Level ${i + 1} label`}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs outline-none"
                />
                {levels.length > 1 ? (
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 p-0.5"
                    onClick={() => removeLevel(i)}
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {levels.length < 10 ? (
            <button
              type="button"
              className="mt-1.5 text-xs text-blue-500 hover:text-blue-600"
              onClick={addLevel}
            >
              + Add level
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={handleSubmit}
          >
            Create
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main page ─────────────────────────────────────────── */

export default function HabitsPage() {
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const mountedRef = useRef(true);

  // Auth
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    setUser(null);
  }, []);

  // Fetch habits
  const refreshHabits = useCallback(async () => {
    try {
      const data = await apiJson("/api/habits");
      if (mountedRef.current) setHabits(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch entries for selected habit + year
  const refreshEntries = useCallback(async () => {
    if (!selectedHabitId) {
      setEntries([]);
      return;
    }
    try {
      const data = await apiJson(
        `/api/habits/entries?habitId=${selectedHabitId}&year=${year}`,
      );
      if (mountedRef.current) setEntries(data);
    } catch (e) {
      console.error(e);
    }
  }, [selectedHabitId, year]);

  useEffect(() => {
    mountedRef.current = true;
    refreshHabits();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshHabits]);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  // Auto-select first habit
  useEffect(() => {
    if (!selectedHabitId && habits.length) {
      setSelectedHabitId(habits[0]._id);
    }
  }, [habits, selectedHabitId]);

  const createHabit = useCallback(async (data) => {
    try {
      const created = await apiJson("/api/habits", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (mountedRef.current) {
        setHabits((prev) => [...prev, created]);
        setSelectedHabitId(created._id);
        setCreating(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteHabit = useCallback(
    async (habit) => {
      const ok = window.confirm(`Delete habit "${habit.name}"?`);
      if (!ok) return;
      try {
        await apiJson("/api/habits", {
          method: "DELETE",
          body: JSON.stringify({ id: habit._id }),
        });
        if (mountedRef.current) {
          setHabits((prev) => prev.filter((h) => h._id !== habit._id));
          if (selectedHabitId === habit._id) setSelectedHabitId(null);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [selectedHabitId],
  );

  const setEntryLevel = useCallback(
    async (habitId, date, level) => {
      // Optimistic update
      setEntries((prev) => {
        if (level === 0) return prev.filter((e) => e.date !== date);
        const existing = prev.find((e) => e.date === date);
        if (existing) {
          return prev.map((e) => (e.date === date ? { ...e, level } : e));
        }
        return [...prev, { habit: habitId, date, level }];
      });

      try {
        await apiJson("/api/habits/entries", {
          method: "PUT",
          body: JSON.stringify({ habitId, date, level }),
        });
      } catch (e) {
        console.error(e);
        refreshEntries();
      }
    },
    [refreshEntries],
  );

  const selectedHabit = habits.find((h) => h._id === selectedHabitId);

  const entriesByDate = useMemo(() => {
    const map = {};
    for (const e of entries) {
      map[e.date] = e;
    }
    return map;
  }, [entries]);

  const totalTracked = entries.filter((e) => e.level > 0).length;

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed bottom-4 right-4 z-40">
        <button
          type="button"
          className="w-12 h-12 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg flex items-center justify-center"
          onClick={() => setMobileSidebarOpen((v) => !v)}
          aria-label="Toggle habits sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7h18M3 12h18M3 17h18"
            />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileSidebarOpen ? (
          <motion.div
            className="md:hidden fixed inset-0 bg-black/40 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="w-full h-[calc(100vh-6rem)] flex flex-col md:flex-row">
        {/* Sidebar — habits list */}
        <div
          className={`${
            mobileSidebarOpen
              ? "fixed inset-y-0 left-0 z-30 w-[280px] pt-24 bg-gray-50 dark:bg-gray-950 shadow-2xl"
              : "hidden"
          } md:block md:static md:w-[280px] md:pt-0 md:bg-transparent md:shadow-none h-full px-4 pb-6 overflow-y-auto`}
        >
          <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3 overflow-hidden">
            <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
              Habits
            </div>

            <div className="space-y-1 mt-1">
              {habits.map((h) => {
                const palette = getPalette(h.color);
                const isActive = selectedHabitId === h._id;
                return (
                  <div
                    key={h._id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
                    }`}
                    onClick={() => {
                      setSelectedHabitId(h._id);
                      setSelectedDate(null);
                      setMobileSidebarOpen(false);
                    }}
                  >
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${palette.swatch}`}
                    />
                    <div className="flex-1 min-w-0 truncate">{h.name}</div>
                    <button
                      type="button"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHabit(h);
                      }}
                      aria-label="Delete habit"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {!habits.length && !creating ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No habits yet
                </div>
              ) : null}
            </div>

            <AnimatePresence>
              {creating ? (
                <CreateHabitForm
                  onSubmit={createHabit}
                  onCancel={() => setCreating(false)}
                />
              ) : null}
            </AnimatePresence>

            {!creating ? (
              <button
                type="button"
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setCreating(true)}
              >
                <IconPlus className="w-4 h-4" />
                Create habit
              </button>
            ) : null}
          </div>
        </div>

        {/* Main — heatmap */}
        <div className="flex-1 h-full px-2 md:px-0 md:pr-4 pb-6 overflow-hidden min-w-0">
          <div className="h-full bg-white/40 dark:bg-gray-950/10 border border-gray-200/50 dark:border-gray-800/40 rounded-2xl overflow-hidden">
            <div className="h-full overflow-auto p-4 md:p-6">
              {selectedHabit ? (
                <div>
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedHabit.name}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {totalTracked} day{totalTracked !== 1 ? "s" : ""}{" "}
                        tracked in {year}
                      </p>
                    </div>

                    {/* Year navigation */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => setYear((y) => y - 1)}
                      >
                        &larr;
                      </button>
                      <span className="text-sm font-semibold min-w-[3rem] text-center">
                        {year}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => setYear((y) => y + 1)}
                      >
                        &rarr;
                      </button>
                    </div>
                  </div>

                  {/* Heatmap */}
                  <div className="relative">
                    <YearHeatmap
                      year={year}
                      habit={selectedHabit}
                      entriesByDate={entriesByDate}
                      onDayClick={(date) =>
                        setSelectedDate((prev) => (prev === date ? null : date))
                      }
                      selectedDate={selectedDate}
                    />

                    {/* Level picker popover */}
                    <AnimatePresence>
                      {selectedDate ? (
                        <div className="mt-2">
                          <LevelPicker
                            habit={selectedHabit}
                            date={selectedDate}
                            currentLevel={
                              entriesByDate[selectedDate]?.level || 0
                            }
                            onSetLevel={setEntryLevel}
                            onClose={() => setSelectedDate(null)}
                          />
                        </div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Levels reference */}
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Intensity Levels
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {(selectedHabit.levels || [])
                        .sort((a, b) => a.value - b.value)
                        .map((l) => {
                          const maxLvl = Math.max(
                            ...(selectedHabit.levels || []).map((x) => x.value),
                            1,
                          );
                          return (
                            <div
                              key={l.value}
                              className="flex items-center gap-1.5"
                            >
                              <div
                                className={`w-4 h-4 rounded-sm ${getShadeClass(
                                  selectedHabit.color,
                                  l.value,
                                  maxLvl,
                                )}`}
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {l.label}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <p className="text-lg">
                    {habits.length
                      ? "Select a habit to view its tracker"
                      : "Create a habit to get started"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
