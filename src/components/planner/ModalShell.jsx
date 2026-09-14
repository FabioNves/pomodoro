"use client";

// Shared modal frame for the planner: portal, backdrop, Escape to close,
// a header row and a scrollable body. Keeps every planner dialog consistent.

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function IconX({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer = null,
  headerRight = null,
  bodyClassName = "",
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-shell"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            className={`w-full ${SIZES[size] || SIZES.md} max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-surface border border-edge rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
          >
            {title ? (
              <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-edge">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-fg truncate">{title}</h3>
                  {subtitle ? (
                    <p className="text-xs text-fg-subtle mt-0.5 truncate">{subtitle}</p>
                  ) : null}
                </div>
                {headerRight}
                <button
                  type="button"
                  className="text-fg-subtle hover:text-fg p-1 -mr-1 rounded-lg hover:bg-surface-hover"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <IconX className="w-4 h-4" />
                </button>
              </div>
            ) : null}
            <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>
            {footer ? (
              <div className="px-5 py-3 border-t border-edge bg-surface flex flex-wrap items-center justify-end gap-2">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
