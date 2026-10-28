"use client";

import { useLayoutEffect, useState } from "react";

// Portal menus follow their row and prefer opening above it. Measure the real
// content so long frequency/option lists stay inside even a small viewport.
export function useRowPopover(open, anchorRef, menuRef) {
  const [style, setStyle] = useState({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const above = Math.max(0, rect.top - gap - margin);
      const below = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
      const height = menu.scrollHeight + 2;
      const up = height <= above || (height > below && above >= below);
      const maxHeight = Math.min(window.innerHeight - margin * 2, up ? above : below);
      const width = Math.min(menu.offsetWidth, window.innerWidth - margin * 2);
      const next = {
        position: "fixed",
        top: Math.max(margin, up ? rect.top - gap - Math.min(height, maxHeight) : rect.bottom + gap),
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        maxHeight,
        maxWidth: "calc(100vw - 16px)",
        overflowY: "auto",
        visibility: "visible",
      };
      setStyle((old) => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    place();
    const observer = new ResizeObserver(place);
    if (menuRef.current) observer.observe(menuRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, menuRef]);
  return style;
}
