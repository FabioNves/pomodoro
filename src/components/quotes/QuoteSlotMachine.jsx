"use client";

// A slot machine of quotes: pull the lever (or press Spin) and the window
// flicks through the quotes, slowing down until one lands. The dashboard
// shows it once the day's blocks are done; the notebook's Quotes view uses
// the compact form as a live preview of the active quotes.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Delay before each frame of a spin: fast at first, then easing out.
const SPIN_FRAMES = [45, 45, 50, 55, 60, 70, 80, 95, 115, 140, 170, 210, 260, 330];
const REEL_SYMBOLS = ["✦", "★", "●", "◆", "✦", "▲", "★", "●"];

function randomIndex(length, avoid) {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  if (index === avoid) index = (index + 1 + Math.floor(Math.random() * (length - 1))) % length;
  return index;
}

function Reel({ spinning, compact }) {
  const strip = [...REEL_SYMBOLS, ...REEL_SYMBOLS];
  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 self-stretch overflow-hidden rounded-lg border border-edge bg-surface-2/80 ${
        compact ? "w-5" : "w-6 sm:w-7"
      }`}
    >
      {/* Absolute, so the strip's own length never stretches the row. */}
      <motion.div
        className="absolute inset-x-0 top-0 flex flex-col items-center text-[10px] leading-5 text-fg-subtle"
        animate={spinning ? { y: ["0%", "-50%"] } : { y: "0%" }}
        transition={spinning ? { repeat: Infinity, duration: 0.45, ease: "linear" } : { type: "spring", stiffness: 260, damping: 22 }}
      >
        {strip.map((s, i) => (
          <span key={i} className="h-5">
            {s}
          </span>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-surface to-transparent" />
    </div>
  );
}

function Lever({ onPull, disabled, spinning }) {
  return (
    <button
      type="button"
      onClick={onPull}
      disabled={disabled}
      aria-label="Spin the quotes"
      title="Spin"
      className="group relative shrink-0 w-10 self-stretch rounded-xl border border-edge bg-surface-2/60 hover:bg-surface-hover transition-colors disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
    >
      <span className="absolute left-1/2 bottom-[calc(50%-0.5rem)] -translate-x-1/2 w-4 h-2 rounded-sm bg-edge-strong" />
      <motion.span
        className="absolute left-1/2 bottom-[calc(50%-0.25rem)] w-1.5 rounded-full bg-fg-subtle origin-bottom"
        style={{ height: "2.1rem", marginLeft: "-0.1875rem" }}
        animate={{ rotate: spinning ? 165 : 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
      >
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent shadow-md shadow-accent/40 group-hover:scale-110 transition-transform" />
      </motion.span>
      <span className="sr-only">Spin</span>
    </button>
  );
}

export default function QuoteSlotMachine({
  quotes,
  caption = "",
  onManage = null,
  manageLabel = "Manage quotes",
  compact = false,
  autoSpin = true,
  className = "",
}) {
  const list = useMemo(() => (quotes || []).filter((q) => q && q.text), [quotes]);
  const [current, setCurrent] = useState(null);
  const [frame, setFrame] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const spinningRef = useRef(false);
  const lastIndex = useRef(-1);
  const timers = useRef([]);
  const reduced = useReducedMotion();

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Also stops a spin in progress when the quotes change under it: its
  // timers close over the old list and would land on an index that is gone.
  useEffect(() => {
    clearTimers();
    spinningRef.current = false;
    setSpinning(false);
    return clearTimers;
  }, [list]);

  const spin = useCallback(() => {
    if (!list.length || spinningRef.current) return;
    const target = randomIndex(list.length, lastIndex.current);
    lastIndex.current = target;
    if (list.length === 1 || reduced) {
      setCurrent(target);
      setFrame((f) => f + 1);
      return;
    }
    spinningRef.current = true;
    setSpinning(true);
    clearTimers();
    let at = 0;
    SPIN_FRAMES.forEach((delay, i) => {
      at += delay;
      const last = i === SPIN_FRAMES.length - 1;
      timers.current.push(
        setTimeout(() => {
          setCurrent(last ? target : randomIndex(list.length, target));
          setFrame((f) => f + 1);
          if (last) {
            spinningRef.current = false;
            setSpinning(false);
          }
        }, at),
      );
    });
  }, [list, reduced]);

  // First quote: spin on arrival, or just show one when motion is reduced.
  useEffect(() => {
    if (!list.length) {
      setCurrent(null);
      return undefined;
    }
    if (current != null && current < list.length) return undefined;
    if (!autoSpin) {
      const index = randomIndex(list.length, -1);
      lastIndex.current = index;
      setCurrent(index);
      return undefined;
    }
    const timer = setTimeout(spin, 250);
    return () => clearTimeout(timer);
  }, [list, current, autoSpin, spin]);

  const quote = current != null ? list[current] : null;
  const pad = compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-5";

  return (
    <section
      className={`relative rounded-2xl border border-edge bg-surface shadow-sm overflow-hidden ${className}`}
      aria-label="Quote slot machine"
    >
      {caption || onManage ? (
        <div className={`flex items-center justify-between gap-3 ${compact ? "px-3 pt-2.5 pb-1.5" : "px-4 pt-3 pb-2 sm:px-5"}`}>
          <p className="min-w-0 flex items-center gap-1.5 text-xs text-fg-subtle">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-accent shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
            </svg>
            <span className="truncate">{caption}</span>
          </p>
          {onManage ? (
            <button
              type="button"
              onClick={onManage}
              className="shrink-0 text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              {manageLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={`flex items-stretch gap-2 sm:gap-3 ${compact ? "px-3 pb-3" : "px-4 pb-4 sm:px-5"}`}>
        {!compact ? <Reel spinning={spinning} /> : null}

        <div
          className={`relative flex-1 min-w-0 rounded-xl border border-edge bg-surface-2/70 overflow-hidden flex items-center ${
            compact ? "min-h-[5rem] max-h-[7rem]" : "min-h-[5.5rem] max-h-[8.5rem]"
          }`}
          aria-live={spinning ? "off" : "polite"}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-surface/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-surface/80 to-transparent z-10" />
          <AnimatePresence mode="popLayout" initial={false}>
            {quote ? (
              <motion.figure
                key={frame}
                initial={{ y: 26, opacity: 0, filter: "blur(5px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -26, opacity: 0, filter: "blur(5px)" }}
                transition={spinning ? { duration: 0.07, ease: "linear" } : { type: "spring", stiffness: 320, damping: 26 }}
                className={`w-full ${pad}`}
              >
                <blockquote
                  className={`max-w-3xl text-fg font-medium leading-snug ${compact ? "text-sm" : "text-sm sm:text-base"}`}
                >
                  “{quote.text}”
                </blockquote>
                <figcaption className={`mt-1.5 text-fg-muted ${compact ? "text-[11px]" : "text-xs"}`}>
                  — {quote.author}
                  {quote.source ? <span className="text-fg-subtle">, {quote.source}</span> : null}
                </figcaption>
              </motion.figure>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`w-full ${pad} text-sm text-fg-muted`}
              >
                {list.length ? "Spinning…" : "No quotes to show yet. Add some in the notebook and switch their authors on."}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!compact ? <Reel spinning={spinning} /> : null}
        {list.length > 1 ? <Lever onPull={spin} disabled={spinning} spinning={spinning} /> : null}
      </div>
    </section>
  );
}
