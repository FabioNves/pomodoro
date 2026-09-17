"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { generateSessionId } from "@/utils/sessionUtils";
import Dropdown from "@/components/ui/Dropdown";
import RoutineFrequencyPicker from "@/components/planner/RoutineFrequencyPicker";
import {
  clockToMinutes,
  describeRoutineSchedule,
  minutesToClock,
  routineFrequencies,
} from "@/lib/routineSchedule";

const COLUMN_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "dropdown", label: "Dropdown" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

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

/* ── Icons ─────────────────────────────────────────────── */

function IconPlus({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconTrash({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconDots({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function IconChevronDown({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ── Color Presets / Pickers ────────────────────────────── */

const COLOR_PRESETS = [
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#eab308", label: "Yellow" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#6b7280", label: "Gray" },
];

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="w-7 h-7 rounded-lg border border-edge flex items-center justify-center hover:scale-110 transition-transform"
        onClick={handleOpen}
        aria-label="Pick color"
      >
        {value ? (
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-dashed border-edge" />
        )}
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="bg-surface border border-edge rounded-xl shadow-xl p-2.5 z-[9999]"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              <div className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2 px-0.5">Color</div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${value === c.value ? "ring-2 ring-offset-1 ring-focus" : ""}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => { onChange(c.value); setOpen(false); }}
                    title={c.label}
                  >
                    {value === c.value ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  className={`w-7 h-7 rounded-lg border-2 border-dashed flex items-center justify-center transition-transform hover:scale-110 ${!value ? "border-primary bg-primary-soft" : "border-edge"}`}
                  onClick={() => { onChange(""); setOpen(false); }}
                  title="No color"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-fg-subtle">
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function InlineColorSwatch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 170 });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="w-7 h-7 rounded-md border border-edge flex items-center justify-center hover:scale-110 transition-transform shrink-0"
        onClick={handleOpen}
        title="Set color for this option"
      >
        {value ? (
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-dashed border-edge" />
        )}
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="z-[10000] bg-surface border border-edge rounded-xl shadow-xl p-2.5"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.1 }}
            >
              <div className="grid grid-cols-5 gap-1.5" style={{ width: "160px" }}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-7 h-7 rounded-md transition-transform hover:scale-110 ${value === c.value ? "ring-2 ring-offset-1 ring-focus" : ""}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => { onChange(c.value); setOpen(false); }}
                    title={c.label}
                  />
                ))}
                <button
                  type="button"
                  className="w-7 h-7 rounded-md border-2 border-dashed border-edge flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={() => { onChange(""); setOpen(false); }}
                  title="No color"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-fg-subtle">
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/* ── Add Column Modal ──────────────────────────────────── */

function AddColumnModal({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState([{ text: "", color: "" }]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = { name: trimmed, type };
    if (type === "dropdown") {
      const validOpts = options.filter((o) => o.text.trim());
      if (!validOpts.length) return;
      data.options = validOpts.map((o) => o.text.trim());
      const rules = validOpts.filter((o) => o.color).map((o) => ({ value: o.text.trim(), color: o.color }));
      if (rules.length) data.colorRules = rules;
    }
    onSubmit(data);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-surface border border-edge rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fg mb-4">Add Custom Column</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-fg-muted mb-1 block">Column Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priority"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-sm text-fg-muted mb-1 block">Type</label>
            <Dropdown
              block
              value={type}
              options={COLUMN_TYPE_OPTIONS}
              onChange={(v) => setType(v)}
              menuLabel="Column type"
              showDot={false}
            />
          </div>
          <AnimatePresence>
            {type === "dropdown" ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-sm text-fg-muted mb-1 block">Options</label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={opt.text}
                        onChange={(e) => {
                          const copy = [...options];
                          copy[i] = { ...copy[i], text: e.target.value };
                          setOptions(copy);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
                      />
                      <InlineColorSwatch
                        value={opt.color}
                        onChange={(c) => {
                          const copy = [...options];
                          copy[i] = { ...copy[i], color: c };
                          setOptions(copy);
                        }}
                      />
                      {options.length > 1 ? (
                        <button
                          type="button"
                          className="text-fg-subtle hover:text-danger p-1"
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-primary hover:text-primary-hover"
                    onClick={() => setOptions([...options, { text: "", color: "" }])}
                  >
                    + Add option
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
            onClick={handleSubmit}
          >
            Add Column
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-edge text-sm hover:bg-surface-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Edit Column Colors Modal ───────────────────────────── */

function EditColumnColorsModal({ column, onSave, onCancel }) {
  const [name, setName] = useState(column.name || "");
  const [colorRules, setColorRules] = useState(() => {
    const existing = column.colorRules || [];
    return (column.options || []).map((opt) => {
      const rule = existing.find((r) => r.value === opt);
      return { value: opt, color: rule?.color || "" };
    });
  });

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-surface border border-edge rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fg mb-4">Edit Column</h3>
        <label className="block text-sm font-medium text-fg-muted mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-edge bg-transparent text-sm text-fg outline-none focus:ring-2 focus:ring-focus mb-4"
          placeholder="Column name"
          autoFocus
        />
        {column.type === "dropdown" && colorRules.length > 0 ? (
          <>
            <label className="block text-sm font-medium text-fg-muted mb-1">Option Colors</label>
            <div className="space-y-2 mb-4">
              {colorRules.map((rule, i) => (
                <div key={rule.value} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-fg">{rule.value}</span>
                  <InlineColorSwatch
                    value={rule.color}
                    onChange={(c) => {
                      const copy = [...colorRules];
                      copy[i] = { ...copy[i], color: c };
                      setColorRules(copy);
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
            onClick={() =>
              onSave({
                name: name.trim() || column.name,
                colorRules: colorRules.filter((r) => r.color),
              })
            }
          >
            Save
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-edge text-sm hover:bg-surface-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ── Column Options Menu ───────────────────────────────── */

function ColumnMenu({ column, onDelete, onClose, onEditColors }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-30 bg-surface border border-edge rounded-xl shadow-lg py-1 min-w-[140px]"
    >
      <button
        type="button"
        className="w-full px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-hover"
        onClick={() => { onEditColors(column); onClose(); }}
      >
        Edit column
      </button>
      <button
        type="button"
        className="w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger-soft"
        onClick={() => { onDelete(column._id); onClose(); }}
      >
        Delete column
      </button>
    </div>
  );
}

/* ── Cell renderers ────────────────────────────────────── */

function DropdownCell({ column, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const colorRule = (column.colorRules || []).find((r) => r.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-2 text-fg hover:opacity-80 transition-all"
        onClick={handleOpen}
      >
        {colorRule?.color ? (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorRule.color }} />
        ) : null}
        <span>{value || "—"}</span>
        <IconChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="w-44 bg-surface border border-edge rounded-xl shadow-xl overflow-hidden z-[9999]"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              <div className="py-1">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    !value
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-fg-subtle hover:bg-surface-hover"
                  }`}
                  onClick={() => { onChange(""); setOpen(false); }}
                >
                  —
                </button>
                {(column.options || []).map((opt) => {
                  const rule = (column.colorRules || []).find((r) => r.value === opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        value === opt
                          ? "bg-primary-soft text-primary font-medium"
                          : "text-fg hover:bg-surface-hover"
                      }`}
                      onClick={() => { onChange(opt); setOpen(false); }}
                    >
                      {rule?.color ? (
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rule.color }} />
                      ) : null}
                      <span>{opt}</span>
                      {value === opt ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 ml-auto text-primary">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function CustomCell({ column, value, onChange }) {
  if (column.type === "dropdown") return <DropdownCell column={column} value={value} onChange={onChange} />;
  if (column.type === "number") {
    return (
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-edge text-sm outline-none"
      />
    );
  }
  if (column.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-edge text-sm outline-none"
      />
    );
  }
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-edge text-sm outline-none"
    />
  );
}

/* ── Main embeddable view ──────────────────────────────── */

export default function RoutineTasksView({ projectId }) {
  const [routineTasks, setRoutineTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnMenuId, setColumnMenuId] = useState(null);
  const [editingColorColumn, setEditingColorColumn] = useState(null);

  const mountedRef = useRef(true);
  const saveTimeoutRef = useRef({});

  // Fetch data
  useEffect(() => {
    mountedRef.current = true;
    if (!projectId) return;
    const fetchAll = async () => {
      try {
        const [tasksData, columnsData] = await Promise.all([
          apiJson(`/api/routine-tasks?projectId=${projectId}`),
          apiJson(`/api/routine-tasks/columns?projectId=${projectId}`),
        ]);
        if (mountedRef.current) {
          setRoutineTasks(tasksData);
          setColumns(columnsData);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAll();
    return () => { mountedRef.current = false; };
  }, [projectId]);

  const addRoutineTask = useCallback(async () => {
    try {
      const task = await apiJson("/api/routine-tasks", {
        method: "POST",
        body: JSON.stringify({ title: "New task", projectId }),
      });
      if (mountedRef.current) setRoutineTasks((prev) => [...prev, task]);
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  // Debounced per task; edits to different fields made within the delay
  // are merged into one PATCH rather than the last one winning.
  const pendingRef = useRef({});
  const saveTask = useCallback((taskId, updates) => {
    pendingRef.current[taskId] = { ...(pendingRef.current[taskId] || {}), ...updates };
    if (saveTimeoutRef.current[taskId]) clearTimeout(saveTimeoutRef.current[taskId]);
    saveTimeoutRef.current[taskId] = setTimeout(async () => {
      const body = pendingRef.current[taskId];
      delete pendingRef.current[taskId];
      if (!body) return;
      try {
        await apiJson("/api/routine-tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: taskId, ...body }),
        });
      } catch (e) {
        console.error(e);
      }
    }, 500);
  }, []);

  const updateTaskLocal = useCallback(
    (taskId, updates) => {
      setRoutineTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, ...updates } : t)));
      saveTask(taskId, updates);
    },
    [saveTask],
  );

  const updateCustomField = useCallback(
    (taskId, columnId, value) => {
      setRoutineTasks((prev) =>
        prev.map((t) => {
          if (t._id !== taskId) return t;
          const fields = [...(t.customFields || [])];
          const idx = fields.findIndex((f) => String(f.column) === String(columnId));
          if (idx >= 0) fields[idx] = { ...fields[idx], value };
          else fields.push({ column: columnId, value });
          return { ...t, customFields: fields };
        }),
      );
      const key = `${taskId}_cf`;
      if (saveTimeoutRef.current[key]) clearTimeout(saveTimeoutRef.current[key]);
      saveTimeoutRef.current[key] = setTimeout(async () => {
        const task = routineTasks.find((t) => t._id === taskId);
        if (!task) return;
        const fields = [...(task.customFields || [])];
        const idx = fields.findIndex((f) => String(f.column) === String(columnId));
        if (idx >= 0) fields[idx] = { ...fields[idx], value };
        else fields.push({ column: columnId, value });
        try {
          await apiJson("/api/routine-tasks", {
            method: "PATCH",
            body: JSON.stringify({ id: taskId, customFields: fields }),
          });
        } catch (e) {
          console.error(e);
        }
      }, 500);
    },
    [routineTasks],
  );

  const deleteTask = useCallback(async (taskId) => {
    setRoutineTasks((prev) => prev.filter((t) => t._id !== taskId));
    try {
      await apiJson("/api/routine-tasks", {
        method: "DELETE",
        body: JSON.stringify({ id: taskId }),
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addColumn = useCallback(
    async (data) => {
      try {
        const col = await apiJson("/api/routine-tasks/columns", {
          method: "POST",
          body: JSON.stringify({ ...data, projectId }),
        });
        if (mountedRef.current) {
          setColumns((prev) => [...prev, col]);
          setShowAddColumn(false);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [projectId],
  );

  const deleteColumn = useCallback(async (colId) => {
    setColumns((prev) => prev.filter((c) => c._id !== colId));
    try {
      await apiJson("/api/routine-tasks/columns", {
        method: "DELETE",
        body: JSON.stringify({ id: colId }),
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const updateColumn = useCallback(async (colId, updates) => {
    setColumns((prev) => prev.map((c) => (c._id === colId ? { ...c, ...updates } : c)));
    try {
      await apiJson("/api/routine-tasks/columns", {
        method: "PATCH",
        body: JSON.stringify({ id: colId, ...updates }),
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const getCustomFieldValue = (task, columnId) => {
    const field = (task.customFields || []).find((f) => String(f.column) === String(columnId));
    return field?.value ?? "";
  };

  if (!projectId) return null;

  return (
    <>
      <div className="bg-surface border border-edge rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge bg-surface-2">
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[200px]">Task</th>
                <th className="px-2 py-3 text-center font-semibold text-fg-muted w-[50px]">
                  <span className="sr-only">Color</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 mx-auto text-fg-subtle">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485" />
                  </svg>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[160px]">Frequency</th>
                <th className="px-2 py-3 text-center font-semibold text-fg-muted w-[60px]" title="Auto-add to schedule">Auto</th>
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[110px]" title="Time of day the task should happen">Time of day</th>
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[100px]" title="How long it takes, in minutes">Duration (min)</th>
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[170px]" title="Only scheduled between these dates">Active</th>
                <th className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[200px]">Notes</th>
                {columns.map((col) => (
                  <th
                    key={col._id}
                    className="px-4 py-3 text-left font-semibold text-fg-muted min-w-[140px] relative"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.name}</span>
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-surface-hover"
                        onClick={() => setColumnMenuId(columnMenuId === col._id ? null : col._id)}
                      >
                        <IconDots className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {columnMenuId === col._id ? (
                          <ColumnMenu
                            column={col}
                            onDelete={deleteColumn}
                            onClose={() => setColumnMenuId(null)}
                            onEditColors={(c) => setEditingColorColumn(c)}
                          />
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 w-[80px]">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
                    onClick={() => setShowAddColumn(true)}
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    Column
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {routineTasks.map((task) => (
                <tr
                  key={task._id}
                  className="border-b border-edge hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTaskLocal(task._id, { title: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-edge-strong focus:border-focus text-sm outline-none transition-colors"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ColorPicker
                      value={task.color || ""}
                      onChange={(c) => updateTaskLocal(task._id, { color: c })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <RoutineFrequencyPicker
                      value={routineFrequencies(task)}
                      monthly={task.monthly || []}
                      summary={describeRoutineSchedule(task)}
                      onChange={(next) => updateTaskLocal(task._id, next)}
                    />
                    {(task.frequencies || []).includes("custom") ||
                    task.frequency === "custom" ? (
                      <input
                        type="text"
                        value={task.frequencyCustom || ""}
                        onChange={(e) => updateTaskLocal(task._id, { frequencyCustom: e.target.value })}
                        placeholder="e.g. Every 3 days"
                        className="w-full mt-1 px-2 py-1 rounded-md bg-transparent border border-edge text-xs outline-none"
                      />
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!task.autoSchedule}
                      onChange={(e) =>
                        updateTaskLocal(task._id, { autoSchedule: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                      title="Auto-add to schedule on matching days"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={minutesToClock(task.startMinute)}
                      onChange={(e) =>
                        updateTaskLocal(task._id, { startMinute: clockToMinutes(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-edge text-sm outline-none"
                      title="Time of day (leave empty for no fixed time)"
                      aria-label="Time of day"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={task.estimatedTime || ""}
                      onChange={(e) =>
                        updateTaskLocal(task._id, {
                          estimatedTime: e.target.value ? Number(e.target.value) : 0,
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-edge text-sm outline-none"
                      min="0"
                      aria-label="Duration in minutes"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {(() => {
                      const invalid =
                        !!task.startDate && !!task.endDate && task.endDate < task.startDate;
                      // An end before the start is kept on screen but not
                      // saved; the API would reject it anyway.
                      const setDates = (patch) => {
                        const next = { ...task, ...patch };
                        if (next.startDate && next.endDate && next.endDate < next.startDate) {
                          setRoutineTasks((prev) =>
                            prev.map((t) => (t._id === task._id ? { ...t, ...patch } : t)),
                          );
                          return;
                        }
                        updateTaskLocal(task._id, patch);
                      };
                      const dateClass = `flex-1 min-w-0 px-1.5 py-1 rounded-md bg-transparent border text-xs outline-none ${
                        invalid ? "border-danger" : "border-edge"
                      }`;
                      return (
                        <div className="space-y-1" title={invalid ? "The end date is before the start date" : undefined}>
                          <label className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
                            <span className="w-8">From</span>
                            <input
                              type="date"
                              value={task.startDate || ""}
                              onChange={(e) => setDates({ startDate: e.target.value })}
                              className={dateClass}
                              aria-label="Active from"
                            />
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
                            <span className="w-8">Until</span>
                            <input
                              type="date"
                              value={task.endDate || ""}
                              onChange={(e) => setDates({ endDate: e.target.value })}
                              className={dateClass}
                              aria-label="Active until"
                            />
                          </label>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={task.notes || ""}
                      onChange={(e) => updateTaskLocal(task._id, { notes: e.target.value })}
                      placeholder="Add notes..."
                      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-edge-strong focus:border-focus text-sm outline-none transition-colors"
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col._id} className="px-4 py-2">
                      <CustomCell
                        column={col}
                        value={getCustomFieldValue(task, col._id)}
                        onChange={(val) => updateCustomField(task._id, col._id, val)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                      onClick={() => deleteTask(task._id)}
                      aria-label="Delete task"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-edge">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-fg-muted hover:bg-surface-hover transition-colors"
            onClick={addRoutineTask}
          >
            <IconPlus className="w-4 h-4" />
            Add cycle
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddColumn ? (
          <AddColumnModal onSubmit={addColumn} onCancel={() => setShowAddColumn(false)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editingColorColumn ? (
          <EditColumnColorsModal
            column={editingColorColumn}
            onSave={({ name, colorRules: rules }) => {
              const updates = { colorRules: rules };
              if (name && name !== editingColorColumn.name) updates.name = name;
              updateColumn(editingColorColumn._id, updates);
              setEditingColorColumn(null);
            }}
            onCancel={() => setEditingColorColumn(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
