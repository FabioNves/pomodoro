"use client";

// A window of quotes under the dashboard greeting, in one of two views: the
// slot machine (pull the lever, or press Spin, and the window flicks through
// the quotes, slowing down until one lands) or the gallery (step through
// them in order with the arrows, a swipe, or the arrow keys). The notebook's
// Quotes view uses the compact form as a live preview of the active quotes.
//
// The window is always the same height: a quote is clamped to two lines and
// a longer one gets a "More" button that lets it out until the next quote.
// The header row holds the view switch, an expand button that opens the
// quote browser (QuotesPlayer: authors down the side, the quotes as cards,
// an auto mode and reading aloud) and a settings button for managing the
// quotes. The compact preview leaves all three out, as the notebook already
// lists every quote.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import QuotesPlayer from "@/components/quotes/QuotesPlayer";
import { QUOTE_VIEWS } from "@/lib/dashboardSettings";

// Delay before each frame of a spin: fast at first, then easing out.
const SPIN_FRAMES = [45, 45, 50, 55, 60, 70, 80, 95, 115, 140, 170, 210, 260, 330];
const REEL_SYMBOLS = ["✦", "★", "●", "◆", "✦", "▲", "★", "●"];
// A shorter drag across the gallery is a tap, not a swipe.
const SWIPE_PX = 40;

function randomIndex(length, avoid) {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  if (index === avoid) index = (index + 1 + Math.floor(Math.random() * (length - 1))) % length;
  return index;
}

/* ── icons ─────────────────────────────────────────────── */

const icon = (d, extra = null) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {d ? <path d={d} /> : null}
        {extra}
      </svg>
    );
  };
const IconReels = icon("M9 5v14M15 5v14", <rect x="3" y="5" width="18" height="14" rx="2" />);
const IconCarousel = icon("M3 8v8M21 8v8", <rect x="7" y="5" width="10" height="14" rx="1.5" />);
const IconExpand = icon("M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7");
const IconGear = icon(
  "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  <circle cx="12" cy="12" r="3" />,
);
const IconChevronLeft = icon("M15 6l-6 6 6 6");
const IconChevronRight = icon("M9 6l6 6-6 6");
const IconChevronDown = icon("M6 9l6 6 6-6");
const VIEW_ICONS = { slot: IconReels, gallery: IconCarousel };

/* ── pieces ────────────────────────────────────────────── */

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

/** Previous / next, in the gallery, where the reels stand in the slot machine. */
function StepButton({ direction, onClick, disabled, compact }) {
  const Icon = direction < 0 ? IconChevronLeft : IconChevronRight;
  const label = direction < 0 ? "Previous quote" : "Next quote";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`shrink-0 self-stretch flex items-center justify-center rounded-xl border border-edge bg-surface-2/60 text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        compact ? "w-8" : "w-10"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function HeaderButton({ label, onClick, active = false, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        active ? "bg-primary-soft text-primary" : "text-fg-subtle hover:text-fg hover:bg-surface-hover"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The words in the window. Measures itself: with the two-line clamp on, a
 * scroll height beyond the client height means there is more to read, and
 * the More button appears. Mounted afresh for every quote, so nothing from
 * the previous one is carried over.
 */
function QuoteBody({ quote, compact, position, expanded, onToggleExpanded }) {
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [quote, expanded]);

  return (
    <>
      <blockquote
        ref={textRef}
        className={`max-w-3xl text-fg font-medium leading-snug ${compact ? "text-sm" : "text-sm sm:text-base"} ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        “{quote.text}”
      </blockquote>
      <figcaption className={`mt-1.5 flex items-center gap-2 text-fg-muted ${compact ? "text-[11px]" : "text-xs"}`}>
        <span className="min-w-0 truncate">
          — {quote.author}
          {quote.source ? <span className="text-fg-subtle">, {quote.source}</span> : null}
        </span>
        {position ? <span className="ml-auto shrink-0 text-[10px] tabular-nums text-fg-subtle">{position}</span> : null}
        {overflow || expanded ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className={`${position ? "" : "ml-auto"} shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-primary hover:bg-primary-soft transition-colors`}
          >
            {expanded ? "Less" : "More"}
            <IconChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        ) : null}
      </figcaption>
    </>
  );
}

/* ── the machine ───────────────────────────────────────── */

/**
 * @param {object} props
 * @param {{ text: string, author: string, source?: string }[]} props.quotes
 * @param {string} [props.caption]         line at the top left
 * @param {(() => void)|null} [props.onManage]  the settings button; null hides it
 * @param {string} [props.manageLabel]
 * @param {boolean} [props.compact]        the notebook preview
 * @param {boolean} [props.autoSpin]       spin once the quotes arrive
 * @param {boolean} [props.expandable]     the button that opens the browser
 * @param {"slot"|"gallery"} [props.view]
 * @param {((view: string) => void)|null} [props.onViewChange]  the view switch; null hides it
 * @param {boolean} [props.loading]        the quotes are still on their way
 */
export default function QuoteSlotMachine({
  quotes,
  caption = "",
  onManage = null,
  manageLabel = "Manage quotes",
  compact = false,
  autoSpin = true,
  expandable = !compact,
  view = "slot",
  onViewChange = null,
  loading = false,
  className = "",
}) {
  const list = useMemo(() => (quotes || []).filter((q) => q && q.text), [quotes]);
  const gallery = view === "gallery";
  const [playerOpen, setPlayerOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [frame, setFrame] = useState(0);
  const [spinning, setSpinning] = useState(false);
  // Which way the gallery moved, for the slide; and which frame was let out
  // of the two-line clamp, so the next quote starts clamped again.
  const [direction, setDirection] = useState(1);
  const [expandedFrame, setExpandedFrame] = useState(-1);
  const spinningRef = useRef(false);
  const lastIndex = useRef(-1);
  const timers = useRef([]);
  const reduced = useReducedMotion();

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Also stops a spin in progress when the quotes change under it (its
  // timers close over the old list and would land on an index that is
  // gone) or when the view switches away from the reels.
  useEffect(() => {
    clearTimers();
    spinningRef.current = false;
    setSpinning(false);
    return clearTimers;
  }, [list, gallery]);

  const spin = useCallback(() => {
    if (!list.length || spinningRef.current) return;
    const target = randomIndex(list.length, lastIndex.current);
    lastIndex.current = target;
    setDirection(1);
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

  /** One quote on, or back, in the gallery. */
  const step = useCallback(
    (delta) => {
      if (list.length < 2 || spinningRef.current) return;
      const from = current == null ? 0 : current;
      const next = (from + delta + list.length) % list.length;
      lastIndex.current = next;
      setDirection(delta < 0 ? -1 : 1);
      setCurrent(next);
      setFrame((f) => f + 1);
    },
    [list, current],
  );

  // First quote: spin on arrival, or just show one in the gallery or when
  // motion is reduced. Nothing while the quotes are still on their way.
  useEffect(() => {
    if (loading) return undefined;
    if (!list.length) {
      setCurrent(null);
      return undefined;
    }
    if (current != null && current < list.length) return undefined;
    if (!autoSpin || gallery) {
      const index = randomIndex(list.length, -1);
      lastIndex.current = index;
      setCurrent(index);
      return undefined;
    }
    const timer = setTimeout(spin, 250);
    return () => clearTimeout(timer);
  }, [list, current, autoSpin, gallery, spin, loading]);

  const quote = current != null ? list[current] : null;
  const expanded = expandedFrame === frame;
  const canStep = gallery && list.length > 1 && !spinning;
  const pad = compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-5";
  const windowHeight = compact ? (expanded ? "min-h-[5.5rem]" : "h-[5.5rem]") : expanded ? "min-h-24" : "h-24";

  // The slot machine drops a quote in from below; the gallery slides it in
  // from the side it was stepped towards.
  const variants = {
    enter: (d) => (reduced ? { opacity: 0 } : gallery ? { x: 40 * d, opacity: 0 } : { y: 26, opacity: 0, filter: "blur(5px)" }),
    center: { x: 0, y: 0, opacity: 1, filter: "blur(0px)" },
    exit: (d) => (reduced ? { opacity: 0 } : gallery ? { x: -40 * d, opacity: 0 } : { y: -26, opacity: 0, filter: "blur(5px)" }),
  };

  const onKeyDown = (e) => {
    if (!canStep || e.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  const showHeader = Boolean(caption || onManage || onViewChange || (expandable && list.length));
  const emptyText = loading
    ? "Loading your quotes…"
    : list.length
      ? "Spinning…"
      : "No quotes to show yet. Add some in the notebook and switch their authors on.";

  return (
    <section
      className={`relative rounded-2xl border border-edge bg-surface shadow-sm overflow-hidden ${className}`}
      aria-label={gallery ? "Quote gallery" : "Quote slot machine"}
      onKeyDown={onKeyDown}
    >
      {showHeader ? (
        <div className={`flex items-center justify-between gap-3 ${compact ? "px-3 pt-2.5 pb-1.5" : "px-4 pt-3 pb-2 sm:px-5"}`}>
          <p className="min-w-0 flex items-center gap-1.5 text-xs text-fg-subtle">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-accent shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
            </svg>
            <span className="truncate">{caption || "Quotes"}</span>
          </p>
          <div className="shrink-0 flex items-center gap-0.5">
            {onViewChange ? (
              <div
                role="radiogroup"
                aria-label="Quotes view"
                className="inline-flex items-center gap-0.5 p-0.5 mr-1 rounded-lg bg-surface-2 border border-edge"
              >
                {QUOTE_VIEWS.map((v) => {
                  const Icon = VIEW_ICONS[v.id];
                  const active = view === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={v.name}
                      title={`${v.name}: ${v.hint}`}
                      onClick={() => onViewChange(v.id)}
                      className={`p-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
                        active ? "bg-primary-soft text-primary" : "text-fg-subtle hover:text-fg"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            ) : null}
            {expandable && list.length ? (
              <HeaderButton label="Browse all quotes" onClick={() => setPlayerOpen(true)} aria-haspopup="dialog">
                <IconExpand className="w-4 h-4" />
              </HeaderButton>
            ) : null}
            {onManage ? (
              <HeaderButton label={manageLabel} onClick={onManage}>
                <IconGear className="w-4 h-4" />
              </HeaderButton>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`flex items-stretch gap-2 sm:gap-3 ${compact ? "px-3 pb-3" : "px-4 pb-4 sm:px-5"}`}>
        {gallery ? (
          <StepButton direction={-1} onClick={() => step(-1)} disabled={!canStep} compact={compact} />
        ) : !compact ? (
          <Reel spinning={spinning} />
        ) : null}

        <div
          className={`relative flex-1 min-w-0 rounded-xl border border-edge bg-surface-2/70 overflow-hidden flex items-center ${windowHeight}`}
          aria-live={spinning ? "off" : "polite"}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-surface/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-surface/80 to-transparent z-10" />
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            {quote ? (
              <motion.figure
                key={frame}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spinning ? { duration: 0.07, ease: "linear" } : { type: "spring", stiffness: 320, damping: 26 }}
                className={`w-full ${pad} ${canStep ? "touch-pan-y" : ""}`}
                drag={canStep ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                dragSnapToOrigin
                onDragEnd={(_, info) => {
                  if (info.offset.x <= -SWIPE_PX) step(1);
                  else if (info.offset.x >= SWIPE_PX) step(-1);
                }}
              >
                <QuoteBody
                  quote={quote}
                  compact={compact}
                  position={gallery ? `${current + 1} / ${list.length}` : ""}
                  expanded={expanded}
                  onToggleExpanded={() => setExpandedFrame(expanded ? -1 : frame)}
                />
              </motion.figure>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`w-full ${pad} text-sm text-fg-muted`}
              >
                {emptyText}
                {!loading && !list.length && onManage ? (
                  <>
                    {" "}
                    <button type="button" onClick={onManage} className="font-medium text-primary hover:underline underline-offset-2">
                      Open the notebook
                    </button>
                  </>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {gallery ? (
          <StepButton direction={1} onClick={() => step(1)} disabled={!canStep} compact={compact} />
        ) : !compact ? (
          <Reel spinning={spinning} />
        ) : null}
        {!gallery && list.length > 1 ? <Lever onPull={spin} disabled={spinning} spinning={spinning} /> : null}
      </div>

      {expandable ? (
        <QuotesPlayer
          open={playerOpen}
          quotes={list}
          startWith={quote}
          onClose={() => setPlayerOpen(false)}
          onManage={
            onManage
              ? () => {
                  setPlayerOpen(false);
                  onManage();
                }
              : null
          }
        />
      ) : null}
    </section>
  );
}
