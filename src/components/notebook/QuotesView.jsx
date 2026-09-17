"use client";

// The Quotes view: the authors down one side (switch one off and its quotes
// leave the dashboard slot machine), their quotes as cards, a preview of the
// machine itself, and the AI finder. Loads its own data from
// /api/notebook/quotes.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { openExternal } from "@/lib/platform";
import { notebookApi } from "@/lib/notebook/client";
import { authorKey, QUOTE_LIMITS, ORIGIN_LABELS, UNKNOWN_AUTHOR } from "@/lib/notebook/quotes";
import QuoteSlotMachine from "@/components/quotes/QuoteSlotMachine";
import QuoteFinder from "@/components/notebook/QuoteFinder";
import { Locked } from "@/components/access/Gate";
import {
  ActionButton,
  EmptyState,
  Field,
  IconAlert,
  IconCheck,
  IconEdit,
  IconExternal,
  IconPause,
  IconPlay,
  IconPlus,
  IconQuote,
  IconSearch,
  IconShield,
  IconSparkle,
  IconTrash,
  IconUser,
  IconX,
  InlineInput,
  Modal,
  PopoverMenu,
  Spinner,
  inputClass,
  relativeTime,
} from "@/components/notebook/notebookUi";

const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";

/* ── add / edit dialog ─────────────────────────────────── */

function QuoteEditor({ open, quote, authors, onClose, onSave }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(quote?.text || "");
    setAuthor(quote?.author || "");
    setSource(quote?.source || "");
  }, [open, quote]);

  const submit = async (e) => {
    e?.preventDefault();
    const words = text.trim();
    if (!words) return;
    setBusy(true);
    const ok = await onSave({ text: words, author: author.trim() || UNKNOWN_AUTHOR, source: source.trim() });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={quote ? "Edit quote" : "Add a quote"}
      onClose={onClose}
      footer={
        <>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" Icon={IconCheck} onClick={submit} busy={busy} disabled={!text.trim()}>
            {quote ? "Save" : "Add quote"}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Quote">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={QUOTE_LIMITS.text}
            rows={4}
            placeholder="The words themselves, without quotation marks."
            className={`${inputClass} resize-y min-h-[6rem]`}
          />
        </Field>
        <Field label="Author">
          <input
            list="quote-authors"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={QUOTE_LIMITS.author}
            placeholder={UNKNOWN_AUTHOR}
            className={inputClass}
          />
          <datalist id="quote-authors">
            {authors.map((a) => (
              <option key={a.key} value={a.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Source (optional)" hint="The book, speech or year the words come from.">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            maxLength={QUOTE_LIMITS.source}
            placeholder="Meditations, Book IV"
            className={inputClass}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ── pieces ────────────────────────────────────────────── */

function AuthorRow({ author, active, selected, renaming, onSelect, onRename, onCancelRename, ctx }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !renaming && onSelect()}
      onKeyDown={(e) => {
        if (!renaming && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
        selected ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          ctx.onToggleAuthor(author, !active);
        }}
        title={active ? `Pause ${author.name}` : `Use ${author.name} again`}
        aria-label={active ? `Pause ${author.name}` : `Use ${author.name} again`}
        className={`shrink-0 p-1 rounded-md transition-colors ${
          active ? "text-success hover:bg-success-soft" : "text-fg-subtle hover:bg-surface-hover"
        }`}
      >
        {active ? <IconPlay className="w-3.5 h-3.5" /> : <IconPause className="w-3.5 h-3.5" />}
      </button>
      {renaming ? (
        <InlineInput
          value={author.name}
          maxLength={QUOTE_LIMITS.author}
          className="flex-1 min-w-0"
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className={`flex-1 min-w-0 truncate ${active ? "" : "line-through decoration-fg-subtle/60"}`}>
          {author.name}
        </span>
      )}
      <span className="text-[10px] tabular-nums text-fg-subtle">{author.count}</span>
      <PopoverMenu
        label={`Options for ${author.name}`}
        className={menuClass}
        items={[
          {
            label: active ? "Pause in the slot machine" : "Use in the slot machine",
            Icon: active ? IconPause : IconPlay,
            onClick: () => ctx.onToggleAuthor(author, !active),
          },
          { label: "Rename author", Icon: IconEdit, onClick: () => ctx.setRenamingAuthor(author.key) },
          { label: "Find more with AI", Icon: IconSparkle, onClick: () => ctx.onFind(author.name) },
          { divider: true },
          { label: "Delete author and quotes", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteAuthor(author) },
        ]}
      />
    </div>
  );
}

function QuoteCard({ quote, authorActive, ctx }) {
  const muted = !quote.active || !authorActive;
  return (
    <article
      className={`group relative rounded-xl border p-3.5 flex flex-col gap-2 transition-all ${
        muted ? "border-edge bg-surface-2/40 opacity-70" : "border-edge bg-surface hover:border-edge-strong hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-2">
        <IconQuote className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
        <blockquote className="flex-1 min-w-0 text-sm text-fg leading-snug break-words">{quote.text}</blockquote>
        <PopoverMenu
          label="Options for this quote"
          className={`${menuClass} -mr-1 -mt-0.5`}
          items={[
            {
              label: quote.active ? "Skip in the slot machine" : "Use in the slot machine",
              Icon: quote.active ? IconPause : IconPlay,
              onClick: () => ctx.onToggleQuote(quote),
            },
            { label: "Edit", Icon: IconEdit, onClick: () => ctx.setEditing(quote) },
            quote.sourceUrl
              ? { label: "Open the source page", Icon: IconExternal, onClick: () => openExternal(quote.sourceUrl) }
              : null,
            { divider: true },
            { label: "Delete quote", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteQuote(quote) },
          ].filter(Boolean)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-fg-subtle">
        <button
          type="button"
          onClick={() => ctx.onSelectAuthor(quote.authorKey)}
          className="inline-flex items-center gap-1 font-medium text-fg-muted hover:text-fg"
        >
          <IconUser className="w-3 h-3" />
          {quote.author}
        </button>
        {quote.source ? <span className="truncate max-w-[16rem]">{quote.source}</span> : null}
        {quote.verified ? (
          <span
            className="inline-flex items-center gap-1 text-success"
            title="These words were found on the page this quote cites. That the page attributes them correctly is still worth a glance."
          >
            <IconShield className="w-3 h-3" />
            Found on the page
          </span>
        ) : quote.origin === "ai" ? (
          <span className="inline-flex items-center gap-1 text-warning" title="Written from the model's memory; check it">
            <IconAlert className="w-3 h-3" />
            Unverified
          </span>
        ) : null}
        <span title={ORIGIN_LABELS[quote.origin] || ""}>{relativeTime(quote.createdAt)}</span>
        {muted ? <span className="text-fg-subtle">· not in the slot machine</span> : null}
      </div>
    </article>
  );
}

/* ── the view ──────────────────────────────────────────── */

export default function QuotesView({ onCountChange }) {
  const [quotes, setQuotes] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [renamingAuthor, setRenamingAuthor] = useState(null);
  const [editing, setEditing] = useState(null); // quote or {}
  const [finder, setFinder] = useState(null); // { author }
  const mounted = useRef(true);
  // Held in a ref so a caller passing an inline function cannot make `load`
  // change on every render, which would reload the list forever.
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notebookApi("/api/notebook/quotes");
      if (!mounted.current) return;
      setQuotes(data.quotes);
      setAuthors(data.authors);
      countRef.current?.(data.quotes.length);
    } catch (e) {
      if (mounted.current) setError(e.message || "Could not load your quotes.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeKeys = useMemo(() => new Set(authors.filter((a) => a.active).map((a) => a.key)), [authors]);
  const isLive = useCallback((q) => q.active && activeKeys.has(q.authorKey), [activeKeys]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (selectedAuthor && q.authorKey !== selectedAuthor) return false;
      if (!needle) return true;
      return (
        q.text.toLowerCase().includes(needle) ||
        q.author.toLowerCase().includes(needle) ||
        (q.source || "").toLowerCase().includes(needle)
      );
    });
  }, [quotes, search, selectedAuthor]);

  const live = useMemo(() => quotes.filter(isLive), [quotes, isLive]);

  const finderExisting = useMemo(() => {
    if (!finder) return [];
    const key = authorKey(finder.author);
    return quotes.filter((q) => !key || q.authorKey === key).map((q) => q.text);
  }, [quotes, finder]);

  /* ── actions ───────────────────────────────────────── */

  const addQuotes = async (items) => {
    try {
      const data = await notebookApi("/api/notebook/quotes", {
        method: "POST",
        body: items.length === 1 ? items[0] : { quotes: items },
      });
      setQuotes((prev) => {
        const next = [...data.quotes, ...prev];
        countRef.current?.(next.length);
        return next;
      });
      setAuthors(data.authors);
      const added = data.quotes.length;
      toast.success(
        added
          ? `${added} quote${added === 1 ? "" : "s"} added${data.skipped ? `, ${data.skipped} already saved` : ""}.`
          : "You already have those quotes.",
      );
      return true;
    } catch (e) {
      toast.error(e.message || "Could not save the quotes.");
      return false;
    }
  };

  const patchQuote = async (id, patch) => {
    const before = quotes.find((q) => q.id === id);
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    try {
      const data = await notebookApi("/api/notebook/quotes", { method: "PATCH", body: { id, ...patch } });
      setQuotes((prev) => prev.map((q) => (q.id === id ? data.quote : q)));
      setAuthors(data.authors);
      return true;
    } catch (e) {
      // Put back only what this call changed; anything added meanwhile stays.
      if (before) setQuotes((prev) => prev.map((q) => (q.id === id ? before : q)));
      toast.error(e.message || "Could not update the quote.");
      return false;
    }
  };

  const deleteQuote = async (quote) => {
    if (!window.confirm("Delete this quote?")) return;
    try {
      const data = await notebookApi("/api/notebook/quotes", { method: "DELETE", body: { id: quote.id } });
      setQuotes((prev) => {
        const next = prev.filter((q) => q.id !== quote.id);
        countRef.current?.(next.length);
        return next;
      });
      setAuthors(data.authors);
      if (selectedAuthor && !data.authors.some((a) => a.key === selectedAuthor)) setSelectedAuthor(null);
    } catch (e) {
      toast.error(e.message || "Could not delete the quote.");
    }
  };

  const toggleAuthor = async (author, active) => {
    const before = authors;
    setAuthors((prev) => prev.map((a) => (a.key === author.key ? { ...a, active } : a)));
    try {
      const data = await notebookApi("/api/notebook/quotes/authors", {
        method: "PATCH",
        body: { name: author.name, active },
      });
      setAuthors(data.authors);
    } catch (e) {
      setAuthors(before);
      toast.error(e.message || "Could not update the author.");
    }
  };

  const renameAuthor = async (author, newName) => {
    setRenamingAuthor(null);
    if (newName === author.name) return;
    try {
      const data = await notebookApi("/api/notebook/quotes/authors", {
        method: "PATCH",
        body: { name: author.name, newName },
      });
      setAuthors(data.authors);
      const key = authorKey(newName);
      const renamed = new Map((data.quotes || []).map((q) => [q.id, q]));
      setQuotes((prev) => prev.map((q) => renamed.get(q.id) || q));
      if (selectedAuthor === author.key) setSelectedAuthor(key);
    } catch (e) {
      toast.error(e.message || "Could not rename the author.");
    }
  };

  const deleteAuthor = async (author) => {
    const ok = window.confirm(
      `Delete ${author.name} and their ${author.count} quote${author.count === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      const data = await notebookApi("/api/notebook/quotes/authors", { method: "DELETE", body: { name: author.name } });
      const gone = new Set(data.deletedQuoteIds);
      setQuotes((prev) => {
        const next = prev.filter((q) => !gone.has(q.id));
        countRef.current?.(next.length);
        return next;
      });
      setAuthors(data.authors);
      if (selectedAuthor === author.key) setSelectedAuthor(null);
      toast.success("Author deleted.");
    } catch (e) {
      toast.error(e.message || "Could not delete the author.");
    }
  };

  const ctx = {
    onToggleAuthor: toggleAuthor,
    onDeleteAuthor: deleteAuthor,
    setRenamingAuthor,
    onFind: (name) => setFinder({ author: name }),
    onToggleQuote: (quote) => patchQuote(quote.id, { active: !quote.active }),
    onDeleteQuote: deleteQuote,
    setEditing,
    onSelectAuthor: (key) => setSelectedAuthor((prev) => (prev === key ? null : key)),
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-fg-muted">
        <Spinner className="w-4 h-4" />
        Loading your quotes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/40 bg-danger-soft text-danger text-sm max-w-md">
          <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <ActionButton size="sm" onClick={load}>
            Retry
          </ActionButton>
        </div>
      </div>
    );
  }

  const selected = authors.find((a) => a.key === selectedAuthor) || null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-edge flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg leading-tight truncate">
              {selected ? selected.name : "Quotes"}
            </h2>
            <p className="text-[11px] text-fg-subtle">
              {quotes.length} quote{quotes.length === 1 ? "" : "s"} · {authors.length} author
              {authors.length === 1 ? "" : "s"} · {live.length} in the slot machine
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quotes…"
                aria-label="Search quotes"
                className="w-40 sm:w-52 pl-8 pr-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus [&::-webkit-search-cancel-button]:appearance-none"
              />
            </label>
            <Locked feature="ai_quotes">
              <ActionButton size="sm" Icon={IconSparkle} onClick={() => setFinder({ author: selected?.name || "" })}>
                Find with AI
              </ActionButton>
            </Locked>
            <ActionButton size="sm" tone="primary" Icon={IconPlus} onClick={() => setEditing({})}>
              Add quote
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Authors */}
        <aside className="lg:w-60 xl:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-edge flex flex-col min-h-0 max-h-48 lg:max-h-none">
          <div className="px-3 pt-3 pb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Authors</span>
            <span className="text-[10px] text-fg-subtle">{activeKeys.size} on</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5 [scrollbar-width:thin]">
            {authors.length ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAuthor(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAuthor(null);
                    }
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    !selectedAuthor ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                  }`}
                >
                  <IconQuote className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">All authors</span>
                  <span className="text-[10px] tabular-nums text-fg-subtle">{quotes.length}</span>
                </div>
                {authors.map((a) => (
                  <AuthorRow
                    key={a.key}
                    author={a}
                    active={a.active}
                    selected={selectedAuthor === a.key}
                    renaming={renamingAuthor === a.key}
                    onSelect={() => setSelectedAuthor(a.key === selectedAuthor ? null : a.key)}
                    onRename={(name) => renameAuthor(a, name)}
                    onCancelRename={() => setRenamingAuthor(null)}
                    ctx={ctx}
                  />
                ))}
              </>
            ) : (
              <p className="px-2 py-3 text-xs text-fg-subtle">
                No authors yet. Add a quote or let the AI find some.
              </p>
            )}
          </div>
        </aside>

        {/* Quotes */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5 space-y-4 [scrollbar-width:thin]">
          {quotes.length ? (
            <QuoteSlotMachine
              quotes={live}
              compact
              autoSpin={false}
              caption={
                live.length
                  ? `The dashboard shows these ${live.length} quote${live.length === 1 ? "" : "s"} once your blocks are done`
                  : "Switch an author on to feed the dashboard"
              }
            />
          ) : null}

          {visible.length ? (
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
              {visible.map((q) => (
                <QuoteCard key={q.id} quote={q} authorActive={activeKeys.has(q.authorKey)} ctx={ctx} />
              ))}
            </div>
          ) : quotes.length ? (
            <EmptyState
              Icon={IconSearch}
              title="Nothing matches"
              hint={search ? `No quote matches “${search}”.` : "This author has no quotes yet."}
              action={
                <div className="flex items-center gap-2">
                  {search ? (
                    <ActionButton size="sm" Icon={IconX} onClick={() => setSearch("")}>
                      Clear search
                    </ActionButton>
                  ) : null}
                  {selected ? (
                    <Locked feature="ai_quotes">
                      <ActionButton size="sm" Icon={IconSparkle} onClick={() => setFinder({ author: selected.name })}>
                        Find quotes by {selected.name}
                      </ActionButton>
                    </Locked>
                  ) : null}
                </div>
              }
            />
          ) : (
            <EmptyState
              Icon={IconQuote}
              title="No quotes yet"
              hint="Keep the lines that keep you going. They spin on the dashboard once the day's blocks are done."
              action={
                <div className="flex items-center gap-2">
                  <ActionButton size="sm" tone="primary" Icon={IconPlus} onClick={() => setEditing({})}>
                    Add a quote
                  </ActionButton>
                  <Locked feature="ai_quotes">
                    <ActionButton size="sm" Icon={IconSparkle} onClick={() => setFinder({ author: "" })}>
                      Find with AI
                    </ActionButton>
                  </Locked>
                </div>
              }
            />
          )}
        </div>
      </div>

      <QuoteEditor
        open={!!editing}
        quote={editing?.id ? editing : null}
        authors={authors}
        onClose={() => setEditing(null)}
        onSave={(fields) => (editing?.id ? patchQuote(editing.id, fields) : addQuotes([{ ...fields, origin: "manual" }]))}
      />

      <QuoteFinder
        // Keyed by the author, so the dialog starts with it already filled
        // in rather than depending on an effect to put it there.
        key={finder?.author ?? "closed"}
        open={!!finder}
        author={finder?.author || ""}
        // Only this author's quotes: a list of everyone else's would fill the
        // prompt without stopping a single repeat.
        existing={finderExisting}
        onClose={() => setFinder(null)}
        onSave={(items) => addQuotes(items)}
      />
    </div>
  );
}
