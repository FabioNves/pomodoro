"use client";

// One open note: title, folder, subjects, pin, the tabs outline and the
// rich-text editor for the active tab. Edits are saved a moment after the
// user stops typing (and when switching tabs or leaving the page); the
// status next to the title says where that stands.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/notebook/sanitize";
import { countWords, htmlToText } from "@/lib/notebook/text";
import { folderPathLabel } from "@/lib/notebook/tree";
import DocumentTabs from "@/components/notebook/DocumentTabs";
import RichTextEditor from "@/components/notebook/RichTextEditor";
import MoveDialog from "@/components/notebook/MoveDialog";
import {
  IconBack,
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconLink,
  IconMenu,
  IconMove,
  IconPin,
  IconPlus,
  IconTabs,
  IconTrash,
  PopoverMenu,
  Spinner,
  SubjectChip,
  SubjectDot,
} from "@/components/notebook/notebookUi";

const SAVE_DELAY = 900;

function SaveStatus({ state, onRetry }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
        <Spinner className="w-3 h-3" /> Saving…
      </span>
    );
  }
  if (state === "dirty") return <span className="text-[11px] text-fg-subtle">Unsaved changes</span>;
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-danger">
        Not saved
        <button type="button" onClick={onRetry} className="underline font-medium">
          Retry
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
      <IconCheck className="w-3 h-3 text-success" /> Saved
    </span>
  );
}

/** Popover to tag the note with existing subjects or create a new one. */
function SubjectPicker({ subjects, selected, onToggle, onCreate, onClose }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const list = subjects.filter((s) => !q || s.name.toLowerCase().includes(q));
  const exact = subjects.find((s) => s.name.toLowerCase() === q) || null;

  const create = async () => {
    const name = query.trim();
    if (!name || busy) return;
    setBusy(true);
    const created = await onCreate(name);
    setBusy(false);
    if (created) {
      onToggle(created.name, true);
      setQuery("");
    }
  };

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl bg-surface border border-edge shadow-xl p-2 space-y-1.5">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (exact) onToggle(exact.name, !selected.includes(exact.name));
          else if (q) create();
          else if (list.length === 1) onToggle(list[0].name, !selected.includes(list[0].name));
        }}
        maxLength={40}
        placeholder="Find or create a subject…"
        aria-label="Find or create a subject"
        className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
      />
      <div className="max-h-52 overflow-y-auto space-y-0.5 [scrollbar-width:thin]">
        {list.map((s) => {
          const on = selected.includes(s.name);
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onToggle(s.name, !on)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                on ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <SubjectDot color={s.color} />
              <span className="flex-1 min-w-0 truncate">{s.name}</span>
              {on ? <IconCheck className="w-3.5 h-3.5" /> : null}
            </button>
          );
        })}
        {!list.length && !q ? <p className="px-2 py-1 text-xs text-fg-subtle">No subjects yet. Type a name to create one.</p> : null}
        {q && !exact ? (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-50"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Create “{query.trim()}”
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LinkGroup({ label, docs, onOpen }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="inline-flex items-center gap-1">
        <IconLink className="w-3 h-3" />
        {label}:
      </span>
      {docs.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onOpen(d.id)}
          className="px-2 py-0.5 rounded-full bg-surface-2 border border-edge text-fg-muted hover:text-fg hover:border-edge-strong transition-colors max-w-[14rem] truncate"
        >
          {d.title}
        </button>
      ))}
    </div>
  );
}

export default function DocumentEditor({
  doc,
  docs,
  folderIndex,
  settings,
  linkIndex,
  activeTabId,
  onSelectTab,
  onBack,
  onRenameDoc,
  onMoveDoc,
  onTogglePin,
  onDeleteDoc,
  onSetSubjects,
  onAddSubject,
  onAddTab,
  onRenameTab,
  onMoveTab,
  onDeleteTab,
  onSaveTab,
  onOpenDoc,
  onCreateDoc,
  onOpenSidebar,
}) {
  const [title, setTitle] = useState(doc.title);
  const [saveState, setSaveState] = useState("saved");
  const [tabsOpen, setTabsOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [activeWords, setActiveWords] = useState(null);
  // Latest content the editor emitted per tab (the editor is uncontrolled),
  // what is still waiting to be saved, and the debounce timers.
  const latest = useRef(new Map());
  const pending = useRef(new Map());
  const timers = useRef(new Map());
  const inflight = useRef(0);

  useEffect(() => {
    setTitle(doc.title);
  }, [doc.title]);

  const activeTab = doc.tabs.find((t) => t.id === activeTabId) || doc.tabs[0] || null;
  const activeId = activeTab?.id || null;

  useEffect(() => {
    setActiveWords(null);
  }, [activeId]);

  /* ── autosave ────────────────────────────────────────── */

  const flush = useCallback(
    async (tabId, { keepalive = false } = {}) => {
      const timer = timers.current.get(tabId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(tabId);
      }
      if (!pending.current.has(tabId)) return;
      const html = pending.current.get(tabId);
      pending.current.delete(tabId);
      inflight.current += 1;
      setSaveState("saving");
      try {
        await onSaveTab(doc.id, tabId, sanitizeHtml(html), { keepalive });
        inflight.current -= 1;
        if (!pending.current.size && inflight.current === 0) setSaveState("saved");
      } catch {
        inflight.current -= 1;
        if (!pending.current.has(tabId)) pending.current.set(tabId, html);
        setSaveState("error");
      }
    },
    [doc.id, onSaveTab],
  );

  const flushAll = useCallback(
    (options) => {
      for (const tabId of Array.from(pending.current.keys())) flush(tabId, options);
    },
    [flush],
  );

  const handleChange = useCallback(
    (tabId, html) => {
      latest.current.set(tabId, html);
      pending.current.set(tabId, html);
      setSaveState("dirty");
      setActiveWords(countWords(htmlToText(html)));
      const previous = timers.current.get(tabId);
      if (previous) clearTimeout(previous);
      timers.current.set(
        tabId,
        setTimeout(() => flush(tabId), SAVE_DELAY),
      );
    },
    [flush],
  );

  // Save whatever is pending when the note closes or the page unloads.
  useEffect(() => () => flushAll(), [flushAll]);
  useEffect(() => {
    const onUnload = (e) => {
      if (!pending.current.size) return;
      flushAll({ keepalive: true });
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushAll]);

  const selectTab = (tabId) => {
    if (tabId !== activeId) {
      flushAll();
      onSelectTab(tabId);
    }
    setTabsOpen(false);
  };

  const commitTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(doc.title);
      return;
    }
    if (next !== doc.title) onRenameDoc(next);
  };

  /* ── derived ─────────────────────────────────────────── */

  const otherWords = useMemo(
    () => doc.tabs.filter((t) => t.id !== activeId).reduce((sum, t) => sum + countWords(htmlToText(t.content)), 0),
    [doc.tabs, activeId],
  );
  const activeCount =
    activeWords ?? (activeTab ? countWords(htmlToText(latest.current.get(activeTab.id) ?? activeTab.content)) : 0);
  const words = otherWords + activeCount;

  const colorOf = useMemo(() => new Map(settings.subjects.map((s) => [s.name, s.color])), [settings.subjects]);
  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const outgoing = (linkIndex.outgoing.get(doc.id) || []).map((id) => byId.get(id)).filter(Boolean);
  const backlinks = (linkIndex.backlinks.get(doc.id) || []).map((id) => byId.get(id)).filter(Boolean);
  const unresolved = linkIndex.unresolved.get(doc.id) || [];
  const noteTitles = useMemo(
    () => docs.filter((d) => d.id !== doc.id).map((d) => ({ id: d.id, title: d.title })),
    [docs, doc.id],
  );
  const folderLabel = doc.folder ? folderPathLabel(folderIndex, doc.folder) : "Top level";

  const toggleSubject = (name, on) => {
    const has = doc.subjects.includes(name);
    if (on && !has) onSetSubjects([...doc.subjects, name]);
    if (!on && has) onSetSubjects(doc.subjects.filter((s) => s !== name));
  };

  const tabsPanel = (extra) => (
    <DocumentTabs
      tabs={doc.tabs}
      activeTabId={activeId}
      onSelect={selectTab}
      onAdd={onAddTab}
      onRename={onRenameTab}
      onMove={onMoveTab}
      onDelete={onDeleteTab}
      {...extra}
    />
  );

  return (
    <>
      <header className="border-b border-edge px-3 sm:px-5 py-2.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to notes"
            title="Back"
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
          >
            <IconBack className="w-4 h-4" />
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setTitle(doc.title);
                e.currentTarget.blur();
              }
            }}
            maxLength={200}
            aria-label="Note title"
            placeholder="Untitled"
            className="flex-1 min-w-0 bg-transparent text-lg sm:text-xl font-bold text-fg outline-none placeholder:text-fg-subtle rounded-md px-1 -mx-1 focus:bg-surface-2/60 transition-colors"
          />
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <SaveStatus state={saveState} onRetry={() => flushAll()} />
            <span className="text-[11px] text-fg-subtle tabular-nums">{words} words</span>
          </div>
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={doc.pinned}
            title={doc.pinned ? "Unpin" : "Pin to top"}
            aria-label={doc.pinned ? "Unpin" : "Pin to top"}
            className={`p-1.5 rounded-lg transition-colors ${
              doc.pinned ? "bg-accent-soft text-accent" : "text-fg-subtle hover:text-fg hover:bg-surface-hover"
            }`}
          >
            <IconPin className="w-4 h-4" />
          </button>
          <PopoverMenu
            label="Note options"
            items={[
              { label: "Add tab", Icon: IconPlus, onClick: () => onAddTab(null) },
              { label: "Move to…", Icon: IconMove, onClick: () => setMoving(true) },
              { label: doc.pinned ? "Unpin" : "Pin to top", Icon: IconPin, onClick: onTogglePin },
              { divider: true },
              { label: "Delete note", Icon: IconTrash, danger: true, onClick: onDeleteDoc },
            ]}
          />
          <button
            type="button"
            className="md:hidden p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
            aria-label="Open notebook menu"
            onClick={onOpenSidebar}
          >
            <IconMenu className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setMoving(true)}
            title="Move to another folder"
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors max-w-[14rem]"
          >
            <IconFolder className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">{folderLabel}</span>
          </button>
          <span className="text-fg-subtle">·</span>
          <div className="relative flex items-center gap-1.5 flex-wrap">
            {doc.subjects.map((s) => (
              <SubjectChip key={s} name={s} color={colorOf.get(s)} size="xs" onRemove={() => toggleSubject(s, false)} />
            ))}
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              aria-expanded={picking}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-edge-strong text-[11px] font-medium text-fg-muted hover:text-fg hover:border-fg-subtle transition-colors"
            >
              <IconPlus className="w-3 h-3" />
              Subject
            </button>
            {picking ? (
              <SubjectPicker
                subjects={settings.subjects}
                selected={doc.subjects}
                onToggle={toggleSubject}
                onCreate={onAddSubject}
                onClose={() => setPicking(false)}
              />
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="sm:hidden">
              <SaveStatus state={saveState} onRetry={() => flushAll()} />
            </span>
            <button
              type="button"
              onClick={() => setTabsOpen((o) => !o)}
              aria-expanded={tabsOpen}
              className="md:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md border border-edge text-fg-muted hover:text-fg transition-colors max-w-[11rem]"
            >
              <IconTabs className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeTab ? activeTab.title : "Tabs"}</span>
              <span className="text-fg-subtle tabular-nums">({doc.tabs.length})</span>
              <IconChevronDown className={`w-3 h-3 transition-transform ${tabsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {tabsOpen ? (
        <div className="md:hidden border-b border-edge max-h-64 flex flex-col">
          {tabsPanel({ onClose: () => setTabsOpen(false), className: "flex-1 min-h-0" })}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 flex">
        {tabsPanel({ className: "hidden md:flex w-56 lg:w-60 shrink-0 border-r border-edge" })}
        <section className="flex-1 min-w-0 flex flex-col min-h-0">
          {activeTab ? (
            <RichTextEditor
              key={activeTab.id}
              initialHtml={latest.current.get(activeTab.id) ?? activeTab.content}
              onChange={(html) => handleChange(activeTab.id, html)}
              onSaveNow={() => flush(activeTab.id)}
              noteTitles={noteTitles}
              placeholder="Start writing… Type [[ to link another note."
            />
          ) : (
            <p className="p-6 text-sm text-fg-muted">This note has no tabs.</p>
          )}
          {outgoing.length || backlinks.length || unresolved.length ? (
            <div className="border-t border-edge px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-subtle bg-surface/60">
              {outgoing.length ? <LinkGroup label="Links to" docs={outgoing} onOpen={onOpenDoc} /> : null}
              {backlinks.length ? <LinkGroup label="Linked from" docs={backlinks} onOpen={onOpenDoc} /> : null}
              {unresolved.length ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>Not created yet:</span>
                  {unresolved.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onCreateDoc({ title: t })}
                      title="Create this note"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-edge-strong text-fg-muted hover:text-fg hover:border-fg-subtle transition-colors max-w-[14rem]"
                    >
                      <IconPlus className="w-3 h-3 shrink-0" />
                      <span className="truncate">{t}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <MoveDialog
        open={moving}
        title={`Move "${doc.title}" to…`}
        folderIndex={folderIndex}
        currentFolderId={doc.folder}
        onPick={(id) => {
          setMoving(false);
          onMoveDoc(id);
        }}
        onClose={() => setMoving(false)}
      />
    </>
  );
}
