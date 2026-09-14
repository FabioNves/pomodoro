"use client";

// Building blocks shared by the notebook screens: icons, a portal menu, a
// modal and an inline rename field. The generic controls (buttons, chips,
// spinner, empty state) are the same ones the news screens use, re-exported
// here so notebook components import from one place.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX } from "@/components/news/newsUi";

export {
  ActionButton,
  Chip,
  Spinner,
  EmptyState,
  IconPlus,
  IconX,
  IconCheck,
  IconAlert,
  relativeTime,
  formatDate,
} from "@/components/news/newsUi";

/* ── icons ─────────────────────────────────────────────── */

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

export const IconNotebook = icon("M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6a1 1 0 01-1-1V4a1 1 0 011-1zM4 7h2M4 11h2M4 15h2M10 8h5M10 12h4");
export const IconFolder = icon("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z");
export const IconFolderOpen = icon("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H6.5a2 2 0 00-1.9 1.4L3 17V7zm0 10l1.9-6.1A1 1 0 015.9 10H21l-2.2 7.3a1 1 0 01-1 .7H4a1 1 0 01-1-1z");
export const IconFolderPlus = icon("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM12 10v6M9 13h6");
export const IconNote = icon("M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6");
export const IconNotePlus = icon("M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M12 11v6M9 14h6");
export const IconBrain = icon("M9.5 3A3.5 3.5 0 006 6.5a3 3 0 00-2 2.8A3 3 0 005 14.5 3.5 3.5 0 008.5 20c1.4 0 2.6-.8 3.3-2M9.5 3A3.5 3.5 0 0112 5.5V18M9.5 3v.5M14.5 3A3.5 3.5 0 0118 6.5a3 3 0 012 2.8 3 3 0 01-1 5.2 3.5 3.5 0 01-3.5 5.5c-1.4 0-2.6-.8-3.3-2M14.5 3A3.5 3.5 0 0012 5.5");
export const IconList = icon("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01");
export const IconGrid = icon("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z");
export const IconSearch = icon("M21 21l-4.3-4.3", <circle cx="11" cy="11" r="7" />);
export const IconMore = icon("M12 5h.01M12 12h.01M12 19h.01");
export const IconChevronRight = icon("M9 6l6 6-6 6");
export const IconChevronDown = icon("M6 9l6 6 6-6");
export const IconPin = icon("M12 17v5M5 17h14l-2-5V6a1 1 0 00-1-1H8a1 1 0 00-1 1v6l-2 5z");
export const IconTrash = icon("M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3");
export const IconEdit = icon("M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z");
export const IconMove = icon("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM9 13h6m0 0l-2.5-2.5M15 13l-2.5 2.5");
export const IconTabs = icon("M4 5h16v14H4zM4 10h16M9 5v5");
export const IconLink = icon("M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5");
export const IconBack = icon("M19 12H5M12 19l-7-7 7-7");
export const IconMenu = icon("M4 6h16M4 12h16M4 18h16");
export const IconViews = icon("M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z");
export const IconZoomIn = icon("M21 21l-4.3-4.3M11 8v6M8 11h6", <circle cx="11" cy="11" r="7" />);
export const IconZoomOut = icon("M21 21l-4.3-4.3M8 11h6", <circle cx="11" cy="11" r="7" />);
export const IconFit = icon("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5");
export const IconArrowUp = icon("M12 19V5M5 12l7-7 7 7");
export const IconArrowDown = icon("M12 5v14M19 12l-7 7-7-7");
export const IconIndent = icon("M3 6h18M10 12h11M10 18h11M3 10l4 2-4 2");
export const IconOutdent = icon("M3 6h18M10 12h11M10 18h11M7 10l-4 2 4 2");
export const IconSidebar = icon("M4 4h16v16H4zM9 4v16");
export const IconExternal = icon("M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5");
export const IconTag = icon("M20 12l-8 8-9-9V4h7l10 8z", <circle cx="7.5" cy="7.5" r="1.2" />);
export const IconWords = icon("M4 7h16M4 12h10M4 17h13");

/* ── popover menu ──────────────────────────────────────── */

/**
 * "…" button with a floating menu rendered in a portal.
 * items: { label, Icon?, onClick, danger?, disabled?, hint? } or { divider: true }.
 */
export function PopoverMenu({
  items,
  align = "end",
  label = "More",
  trigger = null,
  className = "",
  stopPropagation = true,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 4;
    if (top + m.height > vh - 8) top = Math.max(8, r.top - m.height - 4);
    let left = align === "end" ? r.right - m.width : r.left;
    left = Math.max(8, Math.min(left, vw - m.width - 8));
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const visible = (items || []).filter(Boolean);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseDown={(e) => stopPropagation && e.stopPropagation()}
        className={
          trigger
            ? className
            : `p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors ${className}`
        }
      >
        {trigger || <IconMore className="w-4 h-4" />}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-[9999] min-w-[180px] max-w-[280px] p-1.5 rounded-xl bg-surface border border-edge shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {visible.map((item, i) =>
                item.divider ? (
                  <div key={`d${i}`} className="my-1 border-t border-edge" />
                ) : (
                  <button
                    key={`${item.label}${i}`}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      item.danger
                        ? "text-danger hover:bg-danger-soft"
                        : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                    }`}
                  >
                    {item.Icon ? <item.Icon className="w-4 h-4 shrink-0" /> : null}
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    {item.hint ? <span className="text-[11px] text-fg-subtle">{item.hint}</span> : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── modal ─────────────────────────────────────────────── */

export function Modal({ open, title, onClose, children, footer = null, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`bg-surface rounded-2xl border border-edge shadow-2xl w-full ${
              size === "lg" ? "max-w-2xl" : "max-w-md"
            } max-h-[90vh] flex flex-col`}
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", duration: 0.4 }}
          >
            <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-edge">
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </header>
            <div className="px-5 py-4 overflow-y-auto">{children}</div>
            {footer ? (
              <footer className="px-5 py-3 border-t border-edge flex items-center justify-end gap-2">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ── inline rename ─────────────────────────────────────── */

/** Text field that commits on Enter or blur and cancels on Escape. */
export function InlineInput({
  value,
  onCommit,
  onCancel,
  className = "",
  placeholder,
  maxLength = 200,
  selectAll = true,
}) {
  const [text, setText] = useState(value || "");
  const done = useRef(false);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const next = text.trim();
    if (next && next !== value) onCommit(next);
    else onCancel?.();
  };

  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => selectAll && e.target.select()}
      maxLength={maxLength}
      placeholder={placeholder}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel?.();
        }
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`px-1.5 py-0.5 rounded-md bg-surface border border-focus text-sm text-fg outline-none ${className}`}
    />
  );
}

/* ── small pieces ──────────────────────────────────────── */

export function SubjectDot({ color, className = "w-2.5 h-2.5" }) {
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color || "var(--border-strong)" }}
      aria-hidden="true"
    />
  );
}

/** Coloured subject chip; `active` fills it with the subject colour. */
export function SubjectChip({ name, color, active = false, onClick, onRemove, title, size = "sm" }) {
  const pad = size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const style = active
    ? { backgroundColor: color, borderColor: color, color: "#0b1116" }
    : { borderColor: color ? `${color}80` : undefined };
  const Inner = onClick ? "button" : "span";
  return (
    <Inner
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      style={style}
      className={`inline-flex items-center gap-1.5 max-w-full rounded-full border font-medium transition-colors ${pad} ${
        active ? "" : "bg-surface-2 text-fg-muted hover:text-fg"
      }`}
    >
      {!active ? <SubjectDot color={color} className="w-2 h-2" /> : null}
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`ml-0.5 -mr-1 p-0.5 rounded-full transition-colors ${
            active ? "hover:bg-black/15" : "hover:bg-surface-hover text-fg-subtle hover:text-danger"
          }`}
          aria-label={`Remove ${name}`}
        >
          <IconX className="w-3 h-3" />
        </button>
      ) : null}
    </Inner>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus";

/** Segmented control (list / grid, etc.). */
export function Segmented({ value, options, onChange, size = "sm", label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 bg-surface-2/80 p-0.5 rounded-lg border border-edge"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title || opt.label}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors ${
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${active ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg"}`}
          >
            {opt.Icon ? <opt.Icon className="w-3.5 h-3.5" /> : null}
            {opt.label ? <span className={opt.Icon ? "hidden sm:inline" : ""}>{opt.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
