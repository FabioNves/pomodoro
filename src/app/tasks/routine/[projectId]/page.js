"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { generateSessionId } from "@/utils/sessionUtils";

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

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily", icon: "🔄", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "weekly", label: "Weekly", icon: "📅", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "mon", label: "Monday", icon: "M", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "tue", label: "Tuesday", icon: "T", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "wed", label: "Wednesday", icon: "W", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "thu", label: "Thursday", icon: "T", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "fri", label: "Friday", icon: "F", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "sat", label: "Saturday", icon: "S", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "sun", label: "Sunday", icon: "S", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "custom", label: "Custom", icon: "✏️", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
];

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

function IconDots({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
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

/* ── Frequency Picker (popover) ────────────────────────── */

function FrequencyPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const current = FREQUENCY_OPTIONS.find((o) => o.value === value) || FREQUENCY_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${current.color} hover:opacity-80`}
        onClick={handleOpen}
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <IconChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[9999]"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              <div className="py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Frequency
                </div>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      value === opt.value
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    }`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${opt.color}`}>
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                    {value === opt.value ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 ml-auto text-blue-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                ))}
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

/* ── Color Picker (portal popover with preset swatches) ── */

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
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
        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:scale-110 transition-transform"
        onClick={handleOpen}
        aria-label="Pick color"
      >
        {value ? (
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600" />
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2.5 z-[9999]"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-0.5">
                Color
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                      value === c.value ? "ring-2 ring-offset-1 ring-blue-500" : ""
                    }`}
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
                  className={`w-7 h-7 rounded-lg border-2 border-dashed flex items-center justify-center transition-transform hover:scale-110 ${
                    !value ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600"
                  }`}
                  onClick={() => { onChange(""); setOpen(false); }}
                  title="No color"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400">
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

/* ── Inline Color Swatch (for AddColumnModal option rows) ── */

function InlineColorSwatch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
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
        className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:scale-110 transition-transform shrink-0"
        onClick={handleOpen}
        title="Set color for this option"
      >
        {value ? (
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600" />
        )}
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={ref}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="z-[10000] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2.5"
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
                    className={`w-7 h-7 rounded-md transition-transform hover:scale-110 ${
                      value === c.value ? "ring-2 ring-offset-1 ring-blue-500" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => { onChange(c.value); setOpen(false); }}
                    title={c.label}
                  />
                ))}
                <button
                  type="button"
                  className="w-7 h-7 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={() => { onChange(""); setOpen(false); }}
                  title="No color"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-400">
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
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add Custom Column
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
              Column Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priority"
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
            >
              <option value="text">Text</option>
              <option value="dropdown">Dropdown</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
          </div>

          <AnimatePresence>
            {type === "dropdown" ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  Options
                </label>
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
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
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
                          className="text-gray-400 hover:text-red-500 p-1"
                          onClick={() =>
                            setOptions(options.filter((_, j) => j !== i))
                          }
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:text-blue-600"
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
            className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={handleSubmit}
          >
            Add Column
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
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
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit Column
        </h3>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          placeholder="Column name"
          autoFocus
        />
        {column.type === "dropdown" && colorRules.length > 0 ? (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Option Colors</label>
            <div className="space-y-2 mb-4">
              {colorRules.map((rule, i) => (
                <div key={rule.value} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{rule.value}</span>
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
            className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={() => onSave({ name: name.trim() || column.name, colorRules: colorRules.filter((r) => r.color) })}
          >
            Save
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
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
      className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[140px]"
    >
      <button
        type="button"
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => {
          onEditColors(column);
          onClose();
        }}
      >
        Edit column
      </button>
      <button
        type="button"
        className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={() => {
          onDelete(column._id);
          onClose();
        }}
      >
        Delete column
      </button>
    </div>
  );
}

/* ── Cell renderer ─────────────────────────────────────── */

function DropdownCell({ column, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const colorRule = (column.colorRules || []).find((r) => r.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-80 transition-all"
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
              className="w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[9999]"
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
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60"
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
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                      onClick={() => { onChange(opt); setOpen(false); }}
                    >
                      {rule?.color ? (
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rule.color }} />
                      ) : null}
                      <span>{opt}</span>
                      {value === opt ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 ml-auto text-blue-500">
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
  if (column.type === "dropdown") {
    return <DropdownCell column={column} value={value} onChange={onChange} />;
  }

  if (column.type === "number") {
    return (
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-sm outline-none"
      />
    );
  }

  if (column.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-sm outline-none"
      />
    );
  }

  // text
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-sm outline-none"
    />
  );
}

/* ── Main page ─────────────────────────────────────────── */

export default function RoutineTasksPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [user, setUser] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [routineTasks, setRoutineTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnMenuId, setColumnMenuId] = useState(null);
  const [editingColorColumn, setEditingColorColumn] = useState(null);

  const mountedRef = useRef(true);
  const saveTimeoutRef = useRef({});

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

  // Fetch data
  useEffect(() => {
    mountedRef.current = true;
    if (!projectId) return;

    const fetchAll = async () => {
      try {
        const [tasksData, columnsData, projectsData] = await Promise.all([
          apiJson(`/api/routine-tasks?projectId=${projectId}`),
          apiJson(`/api/routine-tasks/columns?projectId=${projectId}`),
          apiJson("/api/projects"),
        ]);
        if (mountedRef.current) {
          setRoutineTasks(tasksData);
          setColumns(columnsData);
          const proj = projectsData.find((p) => p._id === projectId);
          if (proj) setProjectName(proj.name);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchAll();
    return () => {
      mountedRef.current = false;
    };
  }, [projectId]);

  // CRUD: Create routine task
  const addRoutineTask = useCallback(async () => {
    try {
      const task = await apiJson("/api/routine-tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "New task",
          projectId,
        }),
      });
      if (mountedRef.current) {
        setRoutineTasks((prev) => [...prev, task]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  // Debounced save for inline editing
  const saveTask = useCallback((taskId, updates) => {
    if (saveTimeoutRef.current[taskId]) {
      clearTimeout(saveTimeoutRef.current[taskId]);
    }
    saveTimeoutRef.current[taskId] = setTimeout(async () => {
      try {
        await apiJson("/api/routine-tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: taskId, ...updates }),
        });
      } catch (e) {
        console.error(e);
      }
    }, 500);
  }, []);

  const updateTaskLocal = useCallback(
    (taskId, updates) => {
      setRoutineTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, ...updates } : t)),
      );
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
          const idx = fields.findIndex(
            (f) => String(f.column) === String(columnId),
          );
          if (idx >= 0) {
            fields[idx] = { ...fields[idx], value };
          } else {
            fields.push({ column: columnId, value });
          }
          return { ...t, customFields: fields };
        }),
      );

      // Debounced save
      const key = `${taskId}_cf`;
      if (saveTimeoutRef.current[key]) {
        clearTimeout(saveTimeoutRef.current[key]);
      }
      saveTimeoutRef.current[key] = setTimeout(async () => {
        const task = routineTasks.find((t) => t._id === taskId);
        if (!task) return;
        const fields = [...(task.customFields || [])];
        const idx = fields.findIndex(
          (f) => String(f.column) === String(columnId),
        );
        if (idx >= 0) {
          fields[idx] = { ...fields[idx], value };
        } else {
          fields.push({ column: columnId, value });
        }
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

  // Columns
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
    setColumns((prev) =>
      prev.map((c) => (c._id === colId ? { ...c, ...updates } : c)),
    );
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
    const field = (task.customFields || []).find(
      (f) => String(f.column) === String(columnId),
    );
    return field?.value ?? "";
  };

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => router.push("/tasks")}
            aria-label="Back to tasks"
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

        {/* Table */}
        <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[200px]">
                    Task
                  </th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 w-[50px]">
                    <span className="sr-only">Color</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 mx-auto text-gray-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485" />
                    </svg>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[140px]">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">
                    Time (min)
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[200px]">
                    Notes
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col._id}
                      className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[140px] relative"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.name}</span>
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={() =>
                            setColumnMenuId(
                              columnMenuId === col._id ? null : col._id,
                            )
                          }
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
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium"
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
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) =>
                          updateTaskLocal(task._id, { title: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-blue-300 dark:focus:border-blue-600 text-sm outline-none transition-colors"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <ColorPicker
                        value={task.color || ""}
                        onChange={(c) => updateTaskLocal(task._id, { color: c })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <FrequencyPicker
                        value={task.frequency}
                        onChange={(val) =>
                          updateTaskLocal(task._id, { frequency: val })
                        }
                      />
                      {task.frequency === "custom" ? (
                        <input
                          type="text"
                          value={task.frequencyCustom || ""}
                          onChange={(e) =>
                            updateTaskLocal(task._id, {
                              frequencyCustom: e.target.value,
                            })
                          }
                          placeholder="e.g. Every 3 days"
                          className="w-full mt-1 px-2 py-1 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-xs outline-none"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={task.estimatedTime || ""}
                        onChange={(e) =>
                          updateTaskLocal(task._id, {
                            estimatedTime: e.target.value
                              ? Number(e.target.value)
                              : 0,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-sm outline-none"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={task.notes || ""}
                        onChange={(e) =>
                          updateTaskLocal(task._id, { notes: e.target.value })
                        }
                        placeholder="Add notes..."
                        className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-blue-300 dark:focus:border-blue-600 text-sm outline-none transition-colors"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col._id} className="px-4 py-2">
                        <CustomCell
                          column={col}
                          value={getCustomFieldValue(task, col._id)}
                          onChange={(val) =>
                            updateCustomField(task._id, col._id, val)
                          }
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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

          {/* Add row */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={addRoutineTask}
            >
              <IconPlus className="w-4 h-4" />
              Add routine task
            </button>
          </div>
        </div>
      </div>

      {/* Add column modal */}
      <AnimatePresence>
        {showAddColumn ? (
          <AddColumnModal
            onSubmit={addColumn}
            onCancel={() => setShowAddColumn(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* Edit column colors modal */}
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
    </div>
  );
}
