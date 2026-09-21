"use client";

// The quote player, opened from the slot machine's "View more": every quote
// the machine draws from, by author in a side navigation, one at a time on a
// large stage. Auto mode moves on by itself, silently at reading pace or
// reading each quote aloud with the device's voice or the AI voice.
//
// Keys: Space plays or pauses, ←/→ step, Esc closes.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFeatureGate } from "@/lib/access/client";
import { LockBadge } from "@/components/access/Gate";
import { DEFAULT_QUOTE_VOICE, QUOTE_VOICES, authorKey } from "@/lib/notebook/quotes";
import {
  aiClip,
  aiVoiceAbility,
  deviceVoiceAvailable,
  playClip,
  readingTimeMs,
  speakWithDevice,
  unlockAudio,
} from "@/lib/notebook/quoteVoice";

const PREFS_KEY = "pomodrive.quotePlayer";
const PAUSE_AFTER_VOICE_MS = 1400;

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: the choice just is not remembered */
  }
}

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wait = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

/* ── icons ─────────────────────────────────────────────── */

const icon = (d, extra = null) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d={d} />
        {extra}
      </svg>
    );
  };
const IconPrev = icon("M19 20L9 12l10-8v16zM5 19V5");
const IconNext = icon("M5 4l10 8-10 8V4zM19 5v14");
const IconShuffle = icon("M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5");
const IconSpeaker = icon("M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14");
const IconX = icon("M6 6l12 12M18 6L6 18");
const IconQuote = icon(
  "M9 7H5.5A2.5 2.5 0 003 9.5v2A2.5 2.5 0 005.5 14H7c0 2-1 3-3 3.5M20 7h-3.5A2.5 2.5 0 0014 9.5v2a2.5 2.5 0 002.5 2.5H18c0 2-1 3-3 3.5",
);

function IconPlayPause({ playing, className = "w-5 h-5" }) {
  return playing ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
    </svg>
  );
}

/* ── pieces ────────────────────────────────────────────── */

function AuthorNav({ authors, total, value, onChange }) {
  const row = (key, label, count) => {
    const active = value === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        aria-current={active ? "true" : undefined}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors ${
          active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        }`}
      >
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <span className="text-[10px] tabular-nums text-fg-subtle">{count}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Authors" className="space-y-0.5">
      {row("all", "All quotes", total)}
      <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Authors</p>
      {authors.map((a) => row(a.key, a.name, a.count))}
    </nav>
  );
}

function VoiceChoice({ mode, onChange, aiState }) {
  const options = [
    { key: "off", label: "Off", title: "Silent: each quote stays up long enough to read" },
    {
      key: "device",
      label: "Device",
      title: "Read aloud by this device's own voice",
      disabled: !deviceVoiceAvailable(),
    },
    {
      key: "ai",
      label: "AI voice",
      title: aiState.locked
        ? "Available on Premium"
        : aiState.available === false
          ? aiState.reason || "Not set up on this server"
          : "Read aloud by a natural AI voice",
      disabled: aiState.locked || aiState.disabled || aiState.available === false,
    },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div role="radiogroup" aria-label="Voice" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-edge">
        {options.map((o) => {
          const active = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={o.disabled}
              title={o.title}
              onClick={() => onChange(o.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                active ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {aiState.locked ? <LockBadge /> : null}
    </div>
  );
}

/* ── the player ────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {{ text: string, author: string, source?: string }[]} props.quotes
 * @param {object|null} [props.startWith]  the quote to open on
 * @param {() => void} props.onClose
 * @param {(() => void)|null} [props.onManage]
 */
export default function QuotesPlayer({ open, quotes, startWith = null, onClose, onManage = null }) {
  const reduced = useReducedMotion();
  const gate = useFeatureGate("ai_voice");
  const audioRef = useRef(null);
  const panelRef = useRef(null);

  const [filter, setFilter] = useState("all");
  const [shuffle, setShuffle] = useState(false);
  // The order is kept with the list it was built for: until the two match
  // again (right after picking an author), nothing is on the stage.
  const [orderState, setOrderState] = useState({ list: null, order: [] });
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The voice the reader picked (remembered) and, apart from it, a stand-in
  // for this session when that voice failed (never remembered).
  const [voicePref, setVoicePref] = useState("off");
  const [voiceFallback, setVoiceFallback] = useState(null);
  const [aiVoice, setAiVoice] = useState(DEFAULT_QUOTE_VOICE);
  const [ability, setAbility] = useState({ available: null, reason: "" });
  const [phase, setPhase] = useState("idle"); // idle | loading | speaking | reading | pause
  const [notice, setNotice] = useState("");

  const all = useMemo(() => (quotes || []).filter((q) => q && q.text), [quotes]);

  const authors = useMemo(() => {
    const byKey = new Map();
    for (const q of all) {
      const key = authorKey(q.author) || "unknown";
      const entry = byKey.get(key) || { key, name: q.author || "Unknown", count: 0 };
      entry.count += 1;
      byKey.set(key, entry);
    }
    return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [all]);

  const list = useMemo(
    () => (filter === "all" ? all : all.filter((q) => (authorKey(q.author) || "unknown") === filter)),
    [all, filter],
  );

  // Is the AI voice there at all? Only asked when the plan includes it.
  const aiLocked = gate.locked || gate.disabled;
  useEffect(() => {
    if (!open || aiLocked || gate.hidden) return undefined;
    let live = true;
    aiVoiceAbility().then((a) => {
      if (live) setAbility({ available: Boolean(a?.available), reason: a?.reason || "" });
    });
    return () => {
      live = false;
    };
  }, [open, aiLocked, gate.hidden]);

  // The voice actually used: the pick, unless it is not on offer here or
  // failed this session.
  const voiceMode =
    voiceFallback ||
    (voicePref === "ai" && (aiLocked || ability.available === false)
      ? "off"
      : voicePref === "device" && !deviceVoiceAvailable()
        ? "off"
        : voicePref);

  // Preferences follow the reader from one opening to the next.
  useEffect(() => {
    if (!open) return;
    const prefs = loadPrefs();
    setVoicePref(["off", "device", "ai"].includes(prefs.voiceMode) ? prefs.voiceMode : "off");
    if (QUOTE_VOICES.some((v) => v.key === prefs.aiVoice)) setAiVoice(prefs.aiVoice);
    setShuffle(Boolean(prefs.shuffle));
    setVoiceFallback(null);
    setNotice("");
  }, [open]);

  useEffect(() => {
    if (open) savePrefs({ voiceMode: voicePref, aiVoice, shuffle });
  }, [open, voicePref, aiVoice, shuffle]);

  const order = orderState.list === list ? orderState.order : [];
  const current = order.length ? list[order[pos % order.length]] || null : null;

  // The quote on the stage, for the effects below that must not re-run when
  // it changes. Written after commit, only while the order matches its list.
  const currentRef = useRef(null);
  useEffect(() => {
    if (current) currentRef.current = current;
  }, [current]);
  const startRef = useRef(startWith);
  startRef.current = startWith;

  // Order of the list. It opens on the quote the machine showed; shuffling or
  // picking an author keeps the quote on the stage if the new list has it.
  // Before paint, so the stage never shows an empty frame in between.
  useLayoutEffect(() => {
    if (!open) return;
    const next = shuffle ? shuffled(list.length) : list.map((_, i) => i);
    const anchor = currentRef.current || startRef.current;
    let start = 0;
    if (anchor) {
      const at = list.findIndex((q) => q.text === anchor.text && q.author === anchor.author);
      if (at >= 0) start = Math.max(0, next.indexOf(at));
    }
    setOrderState({ list, order: next });
    setPos(start);
  }, [open, list, shuffle]);

  // Refs for the one-off reading and the prefetch, which run outside render.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const nextRef = useRef(null);
  nextRef.current = order.length > 1 ? list[order[(pos + 1) % order.length]] || null : null;
  const oneOffRef = useRef(null);

  const endOneOff = useCallback(() => {
    oneOffRef.current?.abort();
    oneOffRef.current = null;
  }, []);

  const stopSound = useCallback(() => {
    try {
      audioRef.current?.pause();
    } catch {
      /* nothing playing */
    }
    if (deviceVoiceAvailable()) window.speechSynthesis.cancel();
  }, []);

  // Closing ends everything and forgets the place, so the player reopens on
  // whatever quote the machine shows then.
  useEffect(() => {
    if (open) return undefined;
    endOneOff();
    stopSound();
    setPlaying(false);
    setPhase("idle");
    setFilter("all");
    setOrderState({ list: null, order: [] });
    currentRef.current = null;
    return undefined;
  }, [open, endOneOff, stopSound]);
  useEffect(() => () => {
    endOneOff();
    stopSound();
  }, [endOneOff, stopSound]);

  const step = useCallback(
    (delta) => {
      if (!order.length) return;
      setPos((p) => (p + delta + order.length) % order.length);
    },
    [order.length],
  );

  // Stepping to another quote ends a one-off reading of the previous one.
  useEffect(() => {
    endOneOff();
  }, [pos, filter, endOneOff]);

  /** Reads `quote` with the voice in use; on failure, falls back rather than stalling. */
  const readAloud = useCallback(
    async (quote, signal) => {
      if (voiceMode === "ai") {
        setPhase("loading");
        try {
          const url = await aiClip(quote, aiVoice);
          if (signal.aborted) return;
          // The next quote is fetched while this one plays, so there is no gap.
          if (nextRef.current && nextRef.current !== quote) aiClip(nextRef.current, aiVoice).catch(() => {});
          setPhase("speaking");
          await playClip(audioRef.current, url, signal);
          return;
        } catch (error) {
          if (signal.aborted) return;
          const why = error?.message || "The AI voice is unavailable.";
          // For this session only: the reader's pick is kept for next time.
          if (deviceVoiceAvailable()) {
            setNotice(`${why} Using this device's voice for now.`);
            setVoiceFallback("device");
          } else {
            setNotice(why);
            setVoiceFallback("off");
          }
          return;
        }
      }
      if (voiceMode === "device") {
        setPhase("speaking");
        const spoken = quote.author ? `${quote.text} ... ${quote.author}.` : quote.text;
        await speakWithDevice(spoken, signal);
      }
    },
    [voiceMode, aiVoice],
  );

  // Auto mode: show, read or wait, pause, move on. Restarts whenever the
  // quote or the voice changes; stepping by hand simply lands here.
  useEffect(() => {
    if (!open || !playing || !current) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      if (voiceMode === "off") {
        setPhase("reading");
        await wait(readingTimeMs(current.text), signal);
      } else {
        await readAloud(current, signal);
        if (signal.aborted) return;
        setPhase("pause");
        await wait(PAUSE_AFTER_VOICE_MS, signal);
      }
      if (!signal.aborted) step(1);
    })();
    return () => {
      controller.abort();
      setPhase("idle");
    };
  }, [open, playing, current, voiceMode, readAloud, step]);

  // "Read this one": the quote on the stage, once, straight from the tap.
  const readThisOne = () => {
    const quote = currentRef.current;
    if (!quote || playingRef.current) return;
    endOneOff();
    unlockAudio(audioRef.current);
    setNotice("");
    const controller = new AbortController();
    oneOffRef.current = controller;
    (async () => {
      await readAloud(quote, controller.signal);
      if (oneOffRef.current === controller) oneOffRef.current = null;
      if (!playingRef.current) setPhase("idle");
    })();
  };

  const togglePlay = useCallback(() => {
    // A one-off reading gives way; the tap itself is what lets phones play
    // sound later on.
    endOneOff();
    unlockAudio(audioRef.current);
    setNotice("");
    setPlaying((p) => !p);
  }, [endOneOff]);

  const pickVoice = (mode) => {
    endOneOff();
    unlockAudio(audioRef.current);
    setNotice("");
    setVoiceFallback(null);
    setVoicePref(mode);
  };

  // Keyboard.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " " || e.code === "Space") {
        // On a focused button, Space already means that button.
        if (e.target?.closest?.("button, a")) return;
        e.preventDefault();
        togglePlay();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, step, togglePlay]);

  // Focus moves into the player when it opens.
  useEffect(() => {
    if (open) setTimeout(() => panelRef.current?.focus(), 30);
  }, [open]);

  if (typeof document === "undefined") return null;

  const aiState = {
    locked: gate.locked,
    disabled: gate.disabled,
    available: aiLocked ? null : ability.available,
    reason: ability.reason,
  };
  const dwell = current && voiceMode === "off" ? readingTimeMs(current.text) : 0;
  const status =
    phase === "loading"
      ? "Preparing the voice…"
      : phase === "speaking"
        ? "Reading aloud…"
        : playing
          ? voiceMode === "off"
            ? "Playing"
            : "Next quote in a moment"
          : "Paused";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Quote player"
            className="w-full max-w-5xl h-[min(780px,calc(100dvh-1rem))] flex flex-col bg-surface border border-edge rounded-2xl shadow-2xl overflow-hidden outline-none"
            initial={{ scale: 0.97, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4 }}
          >
            <audio ref={audioRef} preload="auto" className="hidden" />

            {/* Header */}
            <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-edge">
              <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <IconQuote className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-fg leading-tight">Quotes</h2>
                <p className="text-[11px] text-fg-subtle">
                  {all.length} quote{all.length === 1 ? "" : "s"} · {authors.length} author{authors.length === 1 ? "" : "s"}
                </p>
              </div>
              {onManage ? (
                <button
                  type="button"
                  onClick={onManage}
                  className="hidden sm:inline-flex px-2.5 py-1 rounded-lg text-xs font-medium text-primary border border-edge hover:bg-primary-soft transition-colors"
                >
                  Manage quotes
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the quote player"
                className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 min-h-0 flex">
              {/* Side navigation */}
              <aside className="hidden md:block w-56 shrink-0 border-r border-edge overflow-y-auto p-2 [scrollbar-width:thin]">
                <AuthorNav authors={authors} total={all.length} value={filter} onChange={setFilter} />
              </aside>

              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                {/* Authors on phones */}
                <div className="md:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-edge [scrollbar-width:none]">
                  {[{ key: "all", name: "All", count: all.length }, ...authors].map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setFilter(a.key)}
                      className={`shrink-0 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                        filter === a.key ? "bg-primary-soft border-primary/40 text-primary" : "bg-surface-2 border-edge text-fg-muted"
                      }`}
                    >
                      {a.name} <span className="tabular-nums text-fg-subtle">{a.count}</span>
                    </button>
                  ))}
                </div>

                {/* Stage */}
                <section
                  className="relative shrink-0 min-h-[210px] sm:min-h-[250px] flex items-center justify-center px-6 sm:px-12 py-8 bg-gradient-to-b from-surface-2/60 to-surface"
                  aria-live={playing ? "off" : "polite"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {current ? (
                      <motion.figure
                        key={`${current.text}\n${current.author}`}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14, filter: "blur(4px)" }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="max-w-3xl text-center"
                      >
                        <blockquote className="text-lg sm:text-2xl font-semibold text-fg leading-snug text-balance">
                          “{current.text}”
                        </blockquote>
                        <figcaption className="mt-4 text-sm text-fg-muted">
                          — {current.author}
                          {current.source ? <span className="text-fg-subtle">, {current.source}</span> : null}
                        </figcaption>
                      </motion.figure>
                    ) : (
                      <p className="text-sm text-fg-subtle">No quotes here.</p>
                    )}
                  </AnimatePresence>
                </section>

                {/* Controls */}
                <div className="px-3 sm:px-5 py-3 border-y border-edge flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={order.length < 2}
                      aria-label="Previous quote"
                      className="p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-40 transition-colors"
                    >
                      <IconPrev />
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={!order.length}
                      aria-label={playing ? "Pause auto mode" : "Play auto mode"}
                      aria-pressed={playing}
                      className="inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-primary hover:bg-primary-hover text-primary-fg text-sm font-semibold shadow-md shadow-primary/25 disabled:opacity-40 transition-colors"
                    >
                      <IconPlayPause playing={playing} className="w-4 h-4" />
                      {playing ? "Pause" : "Auto"}
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={order.length < 2}
                      aria-label="Next quote"
                      className="p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-40 transition-colors"
                    >
                      <IconNext />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShuffle((s) => !s)}
                      aria-pressed={shuffle}
                      aria-label="Shuffle"
                      title={shuffle ? "Shuffle is on" : "Shuffle"}
                      className={`ml-1 p-2 rounded-lg transition-colors ${
                        shuffle ? "text-primary bg-primary-soft" : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                      }`}
                    >
                      <IconShuffle />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-fg-subtle inline-flex items-center gap-1">
                      <IconSpeaker className="w-3.5 h-3.5" />
                      Voice
                    </span>
                    <VoiceChoice mode={voiceMode} onChange={pickVoice} aiState={aiState} />
                    {voiceMode === "ai" ? (
                      <select
                        value={aiVoice}
                        onChange={(e) => setAiVoice(e.target.value)}
                        aria-label="AI voice"
                        className="px-2 py-1 rounded-lg bg-surface-2 border border-edge text-xs text-fg outline-none focus:border-focus"
                      >
                        {QUOTE_VOICES.map((v) => (
                          <option key={v.key} value={v.key}>
                            {v.label} · {v.hint}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {!playing && voiceMode !== "off" && current ? (
                      <button
                        type="button"
                        onClick={readThisOne}
                        disabled={phase === "loading" || phase === "speaking"}
                        className="px-2.5 py-1 rounded-lg border border-edge text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-50"
                      >
                        Read this one
                      </button>
                    ) : null}
                  </div>

                  <p className="ml-auto text-[11px] text-fg-subtle tabular-nums" aria-live="polite">
                    {order.length ? `${(pos % order.length) + 1} / ${order.length}` : "0 / 0"} · {status}
                  </p>

                  {/* Time until the next quote, in silent auto mode */}
                  <div className="basis-full h-1 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
                    {playing && voiceMode === "off" && current ? (
                      <motion.div
                        key={`${pos}-${current.text}`}
                        className="h-full bg-primary/70"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: dwell / 1000, ease: "linear" }}
                      />
                    ) : phase === "speaking" || phase === "loading" ? (
                      <div className="h-full w-1/3 bg-accent/70 animate-pulse" />
                    ) : null}
                  </div>
                  {notice ? <p className="basis-full text-xs text-warning">{notice}</p> : null}
                </div>

                {/* Every quote in this list */}
                <ol className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-1 [scrollbar-width:thin]" aria-label="Quotes in this list">
                  {order.map((idx, i) => {
                    const q = list[idx];
                    if (!q) return null;
                    const active = i === pos % order.length;
                    return (
                      <li key={`${idx}-${q.text}`}>
                        <button
                          type="button"
                          onClick={() => setPos(i)}
                          aria-current={active ? "true" : undefined}
                          className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            active ? "bg-primary-soft" : "hover:bg-surface-hover"
                          }`}
                        >
                          <span className={`mt-0.5 text-[10px] tabular-nums w-5 shrink-0 ${active ? "text-primary font-semibold" : "text-fg-subtle"}`}>
                            {i + 1}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm leading-snug ${active ? "text-fg font-medium" : "text-fg-muted"}`}>
                              {q.text}
                            </span>
                            <span className="block text-[11px] text-fg-subtle mt-0.5">{q.author}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
