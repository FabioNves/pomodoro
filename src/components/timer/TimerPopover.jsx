"use client";

// Small floating panel for the timer's pickers (timing, what you are working
// on). Rendered in a portal so the panel is never clipped by the timer card
// or the navbar modal. Escape and an outside click close it without closing
// the modal underneath; `data-dropdown-menu` tells the modal's focus trap to
// leave Tab alone while it is open.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

function place(anchor, menu, align) {
  const margin = 8;
  const gap = 8;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(menu.offsetWidth, vw - margin * 2);
  const h = menu.offsetHeight;
  let top = rect.bottom + gap;
  if (top + h > vh - margin) {
    const above = rect.top - h - gap;
    top = above >= margin ? above : Math.max(margin, vh - h - margin);
  }
  let left =
    align === "end" ? rect.right - w : align === "start" ? rect.left : rect.left + rect.width / 2 - w / 2;
  left = Math.max(margin, Math.min(left, vw - w - margin));
  return { top, left };
}

export default function TimerPopover({ anchorRef, open, onClose, align = "center", label, className = "", children }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      if (anchorRef.current && menuRef.current) setPos(place(anchorRef.current, menuRef.current, align));
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro && menuRef.current) ro.observe(menuRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    // Capture on window, so the modal's own Escape handler never sees it.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={menuRef}
          role="dialog"
          aria-label={label}
          data-dropdown-menu
          className={`fixed z-[9999] max-w-[calc(100vw-16px)] rounded-2xl border border-edge bg-surface/95 backdrop-blur-xl shadow-2xl ${className}`}
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            boxShadow: "0 18px 48px -12px rgb(0 0 0 / 0.45), inset 0 1px 0 color-mix(in oklab, var(--fg) 6%, transparent)",
          }}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Uppercase micro label used across the timer pickers. */
export function MicroLabel({ children, className = "" }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle ${className}`}>{children}</p>
  );
}
