"use client";

import React, { useEffect, useRef } from "react";
import ModalShell from "@/components/planner/ModalShell";
import TimerControls from "@/components/TimerControls";

export default function TimerModal({ open, onClose }) {
  const contentRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => contentRef.current?.closest('[role="dialog"]')?.querySelector("button")?.focus());
    const trap = (event) => {
      if (event.key !== "Tab" || document.querySelector("[data-dropdown-menu]")) return;
      const dialog = contentRef.current?.closest('[role="dialog"]');
      const buttons = [...(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])].filter((el) => el.getClientRects().length);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return (
    <ModalShell open={open} onClose={onClose} title="Focus timer" size="md">
      <div ref={contentRef}><TimerControls quick /></div>
    </ModalShell>
  );
}
