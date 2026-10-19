"use client";

// The floating notebook: a button at the bottom right of every signed-in
// screen that opens the whole notebook in a window over the page, so a note
// can be written without leaving what is on screen (the desktop app has no
// tabs to open the notebook in beside it). The window keeps its place
// (view, folder, note, tab) in its own state rather than the URL, so the page
// underneath never navigates; closing it saves the open note
// (DocumentEditor flushes on unmount) and the next opening comes back to it.

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useAccess, useFeatureGate } from "@/lib/access/client";
import { patchParams } from "@/lib/notebook/client";
import { IconNotebook, Spinner } from "@/components/notebook/notebookUi";

// Loaded the first time the window opens, so the notebook (editor, graph,
// quotes…) is not part of every screen's bundle.
const NotebookWorkspace = dynamic(
  () => import("@/components/notebook/NotebookApp").then((m) => m.NotebookWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-fg-muted">
        <Spinner className="w-4 h-4" />
        Opening the notebook…
      </div>
    ),
  },
);

// Screens with no button: the notebook itself, and the ones shown before
// signing in.
const HIDDEN_ON = ["/notebook", "/auth", "/pricing"];

// Something of the notebook's own is open above the window (a dialog, a menu,
// the editor's link or note picker): Escape belongs to that first.
function nestedLayerOpen() {
  return (
    document.querySelectorAll('[aria-modal="true"]').length > 1 ||
    !!document.querySelector('[role="menu"], [data-popover], [data-dropdown-menu]')
  );
}

export default function QuickNotebook() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { signedIn } = useAccess();
  const gate = useFeatureGate("notebook");
  const [open, setOpen] = useState(false);
  const [params, setLocalParams] = useState(() => new URLSearchParams());

  const setParams = useCallback((patch) => setLocalParams((prev) => patchParams(prev, patch)), []);
  const close = useCallback(() => setOpen(false), []);

  const hiddenHere = pathname === "/" || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const available = signedIn && gate.allowed && !gate.hidden && !hiddenHere;

  // Moving to another screen (or to the notebook itself) closes the window.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || nestedLayerOpen()) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    // The page underneath stays put while the window is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  if (!available || typeof document === "undefined") return null;

  const expand = () => {
    const query = params.toString();
    setOpen(false);
    router.push(query ? `/notebook?${query}` : "/notebook");
  };

  return (
    <>
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="quick-notebook-button"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.16 }}
            className="fixed right-4 md:right-6 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 ring-1 ring-black/5 flex items-center justify-center hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/60"
            aria-label="Open the notebook"
            title="Notebook"
            data-testid="quick-notebook-button"
          >
            <IconNotebook className="w-5 h-5 md:w-6 md:h-6" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="quick-notebook"
              className="fixed inset-0 z-[65] flex items-stretch sm:items-center justify-center sm:p-6 bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Notebook"
                className="w-full h-full sm:h-[min(88vh,900px)] sm:max-w-6xl flex flex-col bg-surface sm:border sm:border-edge sm:rounded-2xl shadow-2xl overflow-hidden pt-[env(safe-area-inset-top)] sm:pt-0"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                data-testid="quick-notebook"
              >
                <NotebookWorkspace params={params} setParams={setParams} embedded onExpand={expand} onClose={close} />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
