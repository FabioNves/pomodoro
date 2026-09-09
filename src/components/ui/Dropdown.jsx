"use client";

// App-wide dropdown: a pill trigger and a floating, animated menu rendered in
// a portal (so it is never clipped by overflow-hidden parents). Options can
// carry a colour dot, be grouped into collapsible sections, and an optional
// "Custom" row reveals an inline input (number or text).

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const TONES = {
  accent: { dot: "bg-accent", open: "border-accent bg-accent-soft", active: "bg-accent-soft text-fg" },
  success: { dot: "bg-success", open: "border-success bg-success-soft", active: "bg-success-soft text-fg" },
  primary: { dot: "bg-primary", open: "border-primary bg-primary-soft", active: "bg-primary-soft text-fg" },
};

function placeMenu(anchorEl, menuW, menuH, align) {
  const margin = 8;
  const gap = 6;
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.bottom + gap;
  if (top + menuH > vh - margin) {
    const above = rect.top - menuH - gap;
    top = above >= margin ? above : Math.max(margin, vh - menuH - margin);
  }
  let left =
    align === "end"
      ? rect.right - menuW
      : align === "center"
        ? rect.left + rect.width / 2 - menuW / 2
        : rect.left;
  left = Math.max(margin, Math.min(left, vw - menuW - margin));
  return { top, left, minWidth: Math.max(rect.width, 180) };
}

const Check = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.09l6.79-6.8a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const Chevron = ({ open, className = "" }) => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${className}`}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

function Dot({ colorClass, color, fallback }) {
  if (!colorClass && !color && !fallback) return null;
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${colorClass || fallback || ""}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    />
  );
}

/**
 * @param {object} props
 * @param {any} props.value
 * @param {{value:any,label:string,shortLabel?:string,hint?:string,color?:string,colorClass?:string,disabled?:boolean}[]} [props.options]
 * @param {{key:string,label:string,color?:string,colorClass?:string,options:object[]}[]} [props.groups] collapsible sections
 * @param {(value:any)=>void} props.onChange
 * @param {string} [props.label]        prefix shown in the trigger ("Focus")
 * @param {string} [props.placeholder]  shown when nothing is selected
 * @param {"accent"|"success"|"primary"} [props.tone]
 * @param {{min?:number,max?:number,unit?:string,label?:string,type?:"number"|"text",placeholder?:string}} [props.custom]
 * @param {boolean} [props.compact]     use shortLabel / hide the label on small screens
 * @param {"start"|"center"|"end"} [props.align]
 * @param {boolean} [props.showDot]     show the tone dot when the option has no colour
 * @param {boolean} [props.block]       full-width trigger (form field style)
 */
export default function Dropdown({
  value,
  options = [],
  groups = null,
  onChange,
  label,
  placeholder = "Choose…",
  tone = "primary",
  custom = null,
  compact = false,
  align = "start",
  showDot = true,
  block = false,
  disabled = false,
  emptyText = "Nothing to choose from",
  onOpen,
  className = "",
  triggerClassName = "",
  menuLabel,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [collapsed, setCollapsed] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const t = TONES[tone] || TONES.primary;

  const grouped = Array.isArray(groups) && groups.length > 0;
  const allOptions = useMemo(
    () => (grouped ? groups.flatMap((g) => g.options || []) : options),
    [grouped, groups, options],
  );
  // Options the arrow keys can reach right now (collapsed groups are skipped).
  const visibleOptions = useMemo(
    () =>
      grouped
        ? groups.flatMap((g) => (collapsed[g.key] ? [] : g.options || []))
        : options,
    [grouped, groups, options, collapsed],
  );

  const selected = useMemo(
    () => allOptions.find((o) => String(o.value) === String(value)) || null,
    [allOptions, value],
  );
  const isCustomValue = custom && !selected && value !== "" && value != null;
  const customType = custom?.type === "text" ? "text" : "number";

  const close = useCallback(() => {
    setOpen(false);
    setCustomMode(false);
    setFocusIdx(-1);
  }, []);

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      onOpen?.();
      setCustomMode(!!isCustomValue);
    }
    setOpen((o) => !o);
  };

  // Position after the menu renders (needs its size), and keep it in place.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const update = () => {
      const m = menuRef.current.getBoundingClientRect();
      setPos(placeMenu(triggerRef.current, m.width, m.height, align));
    };
    update();
    const onScroll = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      close();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, align, customMode, close, allOptions.length, collapsed]);

  // Outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (customMode) inputRef.current?.focus();
  }, [customMode]);

  const pick = (opt) => {
    if (opt.disabled) return;
    onChange?.(opt.value);
    close();
  };

  const onMenuKey = (e) => {
    const n = visibleOptions.length + (custom ? 1 : 0);
    if (!n) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter" && focusIdx >= 0) {
      e.preventDefault();
      if (focusIdx < visibleOptions.length) pick(visibleOptions[focusIdx]);
      else setCustomMode(true);
    }
  };

  const clampCustom = (raw) => {
    if (customType === "text") return raw;
    const min = custom?.min ?? 0;
    const max = custom?.max ?? 9999;
    return Math.max(min, Math.min(max, Number(raw) || 0));
  };

  const valueText = selected
    ? selected.label
    : isCustomValue
      ? `${value}${custom?.unit ? ` ${custom.unit}` : ""}`
      : placeholder;
  const shortText = selected?.shortLabel || (isCustomValue ? `${value}` : null);

  // Renders one selectable row; `idx` is its position among visible options.
  const renderOption = (opt, idx, inGroup = false) => {
    const active =
      selected && String(opt.value) === String(selected.value) && !customMode;
    const focused = focusIdx === idx;
    return (
      <button
        key={String(opt.value)}
        type="button"
        role="option"
        aria-selected={active}
        disabled={opt.disabled}
        onMouseEnter={() => setFocusIdx(idx)}
        onClick={() => pick(opt)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors disabled:opacity-50 ${
          inGroup ? "pl-4" : ""
        } ${
          active
            ? t.active
            : focused
              ? "bg-surface-hover text-fg"
              : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        }`}
      >
        <Dot
          colorClass={opt.colorClass}
          color={opt.color}
          fallback={showDot && !opt.colorClass && !opt.color ? "bg-edge-strong" : ""}
        />
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium">{opt.label}</span>
          {opt.hint ? (
            <span className="block text-[11px] text-fg-subtle truncate">
              {opt.hint}
            </span>
          ) : null}
        </span>
        {active ? (
          <span className="text-primary">
            <Check />
          </span>
        ) : null}
      </button>
    );
  };

  let cursor = -1; // running index across visible options
  const body = grouped ? (
    groups.map((g) => {
      const isOpen = !collapsed[g.key];
      const list = g.options || [];
      return (
        <div key={g.key} className="mb-0.5 last:mb-0">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() =>
              setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))
            }
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle hover:bg-surface-hover hover:text-fg-muted transition-colors"
          >
            <Chevron open={isOpen} className="text-fg-subtle" />
            <Dot colorClass={g.colorClass} color={g.color} />
            <span className="flex-1 min-w-0 truncate">{g.label}</span>
            <span className="tabular-nums text-fg-subtle/80">{list.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.div
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {list.length ? (
                  list.map((opt) => {
                    cursor += 1;
                    return renderOption(opt, cursor, true);
                  })
                ) : (
                  <div className="px-4 py-1.5 text-[11px] text-fg-subtle">
                    Nothing here
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      );
    })
  ) : options.length ? (
    options.map((opt, i) => renderOption(opt, i))
  ) : !custom ? (
    <div className="px-2.5 py-2 text-xs text-fg-subtle">{emptyText}</div>
  ) : null;

  const trigger = (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={label ? `${label}: ${valueText}` : undefined}
      className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:cursor-default ${
        block ? "w-full justify-between px-3 py-2" : "pl-2.5 pr-2 sm:pl-3 sm:pr-2.5 py-2.5 sm:py-3"
      } ${open ? t.open : "border-edge bg-surface/70 hover:bg-surface-hover disabled:hover:bg-surface/70"} ${triggerClassName}`}
      data-dropdown={label || id || "dropdown"}
    >
      <span className="inline-flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Dot
          colorClass={selected?.colorClass}
          color={selected?.color}
          fallback={showDot && !selected?.colorClass && !selected?.color ? t.dot : ""}
        />
        {label ? (
          <span className={`font-medium text-fg-muted ${compact ? "hidden sm:inline" : ""}`}>
            {label}
          </span>
        ) : null}
        <span
          className={`font-semibold tabular-nums truncate ${selected || isCustomValue ? "text-fg" : "text-fg-subtle"}`}
        >
          {compact && shortText ? (
            <>
              <span className="sm:hidden">{shortText}</span>
              <span className="hidden sm:inline">{valueText}</span>
            </>
          ) : (
            valueText
          )}
        </span>
      </span>
      {!disabled ? <Chevron open={open} className="text-fg-subtle" /> : null}
    </button>
  );

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              role="listbox"
              aria-label={menuLabel || label || "Options"}
              tabIndex={-1}
              onKeyDown={onMenuKey}
              style={{
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                minWidth: pos?.minWidth ?? 180,
                maxWidth: "min(360px, calc(100vw - 16px))",
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-[9999] max-h-[320px] overflow-y-auto p-1.5 rounded-xl bg-surface border border-edge shadow-xl [scrollbar-width:thin]"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              data-dropdown-menu={label || id || "dropdown"}
            >
              {body}

              {custom ? (
                <div
                  role="option"
                  aria-selected={!!isCustomValue}
                  className={`mt-0.5 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    customMode || isCustomValue
                      ? t.active
                      : focusIdx === visibleOptions.length
                        ? "bg-surface-hover text-fg"
                        : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                  }`}
                  onMouseEnter={() => setFocusIdx(visibleOptions.length)}
                  onClick={() => setCustomMode(true)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className="font-medium shrink-0">
                    {custom.label || "Custom"}
                  </span>
                  {customMode ? (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-edge min-w-0">
                      <input
                        ref={inputRef}
                        type={customType}
                        {...(customType === "number"
                          ? { min: custom.min ?? 0, max: custom.max ?? 9999 }
                          : { maxLength: custom.maxLength ?? 200 })}
                        defaultValue={isCustomValue || selected ? value : ""}
                        placeholder={
                          custom.placeholder ??
                          (customType === "number" ? "0" : "Type a name")
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (customType === "number" && e.target.value === "")
                            return;
                          onChange?.(clampCustom(e.target.value));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            close();
                            triggerRef.current?.focus();
                          }
                        }}
                        className={`bg-transparent text-fg font-semibold outline-none caret-primary placeholder:text-fg-subtle placeholder:font-normal ${
                          customType === "number"
                            ? "w-14 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            : "w-full min-w-[8rem]"
                        }`}
                        aria-label={`${custom.label || "Custom"} value`}
                      />
                      {custom.unit ? (
                        <span className="text-[11px] text-fg-subtle shrink-0">
                          {custom.unit}
                        </span>
                      ) : null}
                    </span>
                  ) : isCustomValue ? (
                    <span className="ml-auto text-fg tabular-nums font-semibold truncate">
                      {value}
                      {custom.unit ? ` ${custom.unit}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className={`relative ${block ? "w-full" : "inline-block"} ${className}`}>
      {trigger}
      {menu}
    </div>
  );
}
