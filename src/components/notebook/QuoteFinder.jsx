"use client";

// "Find quotes with AI": type an author, optionally a book or other work to
// draw from and a theme, get a list of candidate quotes, tick the ones worth
// keeping. With "Search the web" the server retrieves pages through the MCP
// server first and only offers quotes it found verbatim on one of them.

import React, { useEffect, useState } from "react";
import { openExternal } from "@/lib/platform";
import { notebookApi } from "@/lib/notebook/client";
import { QUOTE_LIMITS } from "@/lib/notebook/quotes";
import {
  ActionButton,
  IconAlert,
  IconCheck,
  IconExternal,
  IconGlobe,
  IconSearch,
  IconShield,
  IconSparkle,
  Modal,
  Spinner,
  Field,
  inputClass,
} from "@/components/notebook/notebookUi";

const COUNTS = [5, 8, 12, 16];

function Candidate({ quote, checked, onToggle }) {
  return (
    <li>
      <label className="flex items-start gap-3 p-3 rounded-xl border border-edge bg-surface-2/60 hover:border-edge-strong transition-colors cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 w-4 h-4 accent-[var(--primary)] shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-fg leading-snug">“{quote.text}”</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-subtle">
            {quote.source ? <span className="truncate max-w-full">{quote.source}</span> : null}
            {quote.verified ? (
              <span className="inline-flex items-center gap-1 text-success" title="These exact words appear on the page linked below.">
                <IconShield className="w-3 h-3" />
                Found on the page
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning">
                <IconAlert className="w-3 h-3" />
                Unverified
              </span>
            )}
            {quote.sourceUrl ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  openExternal(quote.sourceUrl);
                }}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <IconExternal className="w-3 h-3" />
                Source
              </button>
            ) : null}
          </div>
        </div>
      </label>
    </li>
  );
}

export default function QuoteFinder({ open, author = "", existing = [], onClose, onSave }) {
  // The dialog is keyed by the author it was opened for, so this initial
  // value is the right one from the first render.
  const [name, setName] = useState(author);
  const [work, setWork] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [useWeb, setUseWeb] = useState(true);
  const [ability, setAbility] = useState(null); // { ai, web }
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Seconds left before a rate-limited search is worth trying again.
  const [retryIn, setRetryIn] = useState(0);
  const [result, setResult] = useState(null); // { quotes, warnings, sources, searched }
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setName(author);
    setWork("");
    setTopic("");
    setError(null);
    setResult(null);
    setPicked(new Set());
  }, [open, author]);

  useEffect(() => {
    if (!open || ability) return;
    notebookApi("/api/notebook/quotes/suggest")
      .then((data) => {
        setAbility(data);
        if (!data.web) setUseWeb(false);
      })
      .catch((e) => {
        // A plan that does not include the finder, or a server without a
        // key: say so up front rather than after a search that cannot run.
        setAbility({ ai: false, web: false, reason: e.message || "" });
        setUseWeb(false);
      });
  }, [open, ability]);

  useEffect(() => {
    if (retryIn <= 0) return undefined;
    const id = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [retryIn]);

  const unavailable = ability && !ability.ai;

  const search = async () => {
    const who = name.trim();
    if (!who) {
      setError("Type the name of an author first.");
      return;
    }
    setBusy(true);
    setError(null);
    setRetryIn(0);
    setResult(null);
    setPicked(new Set());
    try {
      const data = await notebookApi("/api/notebook/quotes/suggest", {
        method: "POST",
        body: {
          author: who,
          work: work.trim(),
          topic: topic.trim(),
          count,
          useWeb: useWeb && ability?.web !== false,
          existing: existing.slice(0, 100),
        },
      });
      setResult(data);
      setPicked(new Set(data.quotes.map((_, i) => i)));
      if (!data.quotes.length && !data.warnings?.length) {
        setError(
          work.trim()
            ? `No quotes came back from “${work.trim()}”. Check the title, or search the author without it.`
            : `No quotes came back for “${who}”. Try a different spelling or a broader theme.`,
        );
      }
    } catch (e) {
      setError(e.message || "Could not fetch quotes.");
      // Rate limits clear on their own, so offer the retry rather than
      // leaving the user to guess when.
      setRetryIn(e.status === 429 ? Math.max(5, Number(e.retryAfter) || 20) : 0);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result) return;
    const chosen = result.quotes.filter((_, i) => picked.has(i));
    if (!chosen.length) return;
    setSaving(true);
    const ok = await onSave(chosen);
    setSaving(false);
    if (ok) onClose();
  };

  const toggle = (index) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const quotes = result?.quotes || [];

  return (
    <Modal
      open={open}
      title="Find quotes with AI"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-xs text-fg-subtle">
            {quotes.length ? `${picked.size} of ${quotes.length} selected` : ""}
          </span>
          <ActionButton onClick={onClose}>Close</ActionButton>
          <ActionButton
            tone="primary"
            Icon={IconCheck}
            onClick={save}
            busy={saving}
            disabled={!picked.size || busy}
          >
            Add {picked.size || ""} {picked.size === 1 ? "quote" : "quotes"}
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Author">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && search()}
              maxLength={QUOTE_LIMITS.author}
              placeholder="Marcus Aurelius"
              className={inputClass}
            />
          </Field>
          <Field label="Book or work (optional)" hint="Quotes come only from this one: a book, essay or speech.">
            <input
              value={work}
              onChange={(e) => setWork(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && search()}
              maxLength={QUOTE_LIMITS.source}
              placeholder="Meditations"
              className={inputClass}
            />
          </Field>
          <Field label="Theme (optional)" hint="Narrows the selection: discipline, time, courage…">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && search()}
              maxLength={300}
              placeholder="Anything in particular?"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            How many
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${inputClass} w-auto py-1.5`}>
              {COUNTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${ability?.web === false ? "text-fg-subtle cursor-not-allowed" : "text-fg-muted cursor-pointer"}`}
            title={ability?.web === false ? "No search server is set up on this server" : "Look the quotes up on the web first"}
          >
            <input
              type="checkbox"
              checked={useWeb && ability?.web !== false}
              disabled={ability?.web === false}
              onChange={(e) => setUseWeb(e.target.checked)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <IconGlobe className="w-4 h-4" />
            Search the web for them
          </label>
          <ActionButton
            tone="primary"
            Icon={busy ? undefined : IconSearch}
            busy={busy}
            disabled={unavailable}
            onClick={search}
            className="ml-auto"
          >
            {busy ? "Looking…" : "Find quotes"}
          </ActionButton>
        </div>

        {unavailable ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-warning/40 bg-warning-soft text-warning text-sm">
            <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{ability.reason || "The quote finder is not available here."}</span>
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-edge bg-surface-2/60 text-sm text-fg-muted">
            <Spinner className="w-4 h-4" />
            {useWeb && ability?.web !== false
              ? "Searching the web and reading the pages…"
              : "Asking the model for quotes…"}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-danger/40 bg-danger-soft text-danger text-sm">
            <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p>{error}</p>
              {retryIn > 0 ? (
                <p className="text-xs opacity-80">Trying again is worth it in {retryIn}s.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {result?.warnings?.length ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-warning/40 bg-warning-soft text-warning text-xs">
            <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        ) : null}

        {quotes.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Candidates ({quotes.length})
              </p>
              <div className="flex items-center gap-1.5">
                <ActionButton size="sm" onClick={() => setPicked(new Set(quotes.map((_, i) => i)))}>
                  Select all
                </ActionButton>
                <ActionButton size="sm" onClick={() => setPicked(new Set())}>
                  None
                </ActionButton>
              </div>
            </div>
            <ul className="space-y-2">
              {quotes.map((q, i) => (
                <Candidate key={`${q.text}${i}`} quote={q} checked={picked.has(i)} onToggle={() => toggle(i)} />
              ))}
            </ul>
            {result.sources?.length ? (
              <p className="text-[11px] text-fg-subtle">
                Read {result.sources.length} page{result.sources.length === 1 ? "" : "s"}:{" "}
                {result.sources.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i ? ", " : ""}
                    <button type="button" onClick={() => openExternal(s.url)} className="text-primary hover:underline">
                      {s.domain || s.title || s.url}
                    </button>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}

        {!busy && !result && !error ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-edge bg-surface-2/50 text-xs text-fg-muted">
            <IconSparkle className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
            <span>
              Type an author and the model suggests quotes by them; name a book or other work and the quotes come only
              from it. With the web search on, it may only offer quotes it found on a real page, and shows you which
              one. A quote-listing page can still attribute words to the wrong person, so give anything important a
              second look.
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
