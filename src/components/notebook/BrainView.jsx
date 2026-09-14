"use client";

// The Brain view: an Obsidian-style graph of subjects and notes next to a
// panel for managing subjects (the suggested ones are there from the start;
// add your own or delete any), tagging the selected note and following its
// links.

import React, { useMemo, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { subjectKey } from "@/lib/notebook/subjects";
import { folderPathLabel } from "@/lib/notebook/tree";
import BrainGraph from "@/components/notebook/BrainGraph";
import {
  ActionButton,
  Chip,
  IconBrain,
  IconEdit,
  IconExternal,
  IconFolder,
  IconLink,
  IconNote,
  IconNotePlus,
  IconPlus,
  IconTrash,
  IconX,
  InlineInput,
  PopoverMenu,
  SubjectChip,
  SubjectDot,
  relativeTime,
} from "@/components/notebook/notebookUi";

function Section({ title, count, action = null, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          {title}
          {typeof count === "number" ? <span className="ml-1.5 tabular-nums">({count})</span> : null}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function NoteLine({ doc, onClick, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
    >
      <IconNote className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{doc.title}</span>
      {hint ? <span className="text-[10px] text-fg-subtle shrink-0">{hint}</span> : null}
    </button>
  );
}

export default function BrainView({
  docs,
  settings,
  suggested,
  linkIndex,
  folderIndex,
  onOpenDoc,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onSetDocSubjects,
  onShowSubject,
  onCreateDoc,
}) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState(null); // "s:<name>" | "d:<id>" | null
  const [newSubject, setNewSubject] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [showOrphans, setShowOrphans] = useState(true);
  const [adding, setAdding] = useState(false);

  const colorOf = useMemo(() => new Map(settings.subjects.map((s) => [s.name, s.color])), [settings.subjects]);

  const counts = useMemo(() => {
    const map = new Map(settings.subjects.map((s) => [s.name, 0]));
    for (const d of docs) for (const s of d.subjects) if (map.has(s)) map.set(s, map.get(s) + 1);
    return map;
  }, [docs, settings.subjects]);

  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    for (const s of settings.subjects) {
      const count = counts.get(s.name) || 0;
      nodes.push({ id: `s:${s.name}`, kind: "subject", label: s.name, color: s.color, r: 9 + Math.min(9, count * 1.5), count });
    }
    for (const d of docs) {
      const out = linkIndex.outgoing.get(d.id) || [];
      const back = linkIndex.backlinks.get(d.id) || [];
      const tagged = d.subjects.filter((s) => counts.has(s));
      if (!tagged.length && !out.length && !back.length && !showOrphans) continue;
      const first = tagged[0] || null;
      nodes.push({
        id: `d:${d.id}`,
        kind: "doc",
        label: d.title,
        color: first ? colorOf.get(first) : null,
        r: 4.5 + Math.min(4, (out.length + back.length) * 0.7),
        anchor: first ? `s:${first}` : null,
        docId: d.id,
      });
      for (const s of tagged) edges.push({ source: `d:${d.id}`, target: `s:${s}`, kind: "subject", color: colorOf.get(s) });
      for (const t of out) edges.push({ source: `d:${d.id}`, target: `d:${t}`, kind: "link" });
    }
    return { nodes, edges };
  }, [docs, settings.subjects, counts, colorOf, linkIndex, showOrphans]);

  const selectedDoc = selected?.startsWith("d:") ? docs.find((d) => d.id === selected.slice(2)) || null : null;
  const selectedSubject = selected?.startsWith("s:")
    ? settings.subjects.find((s) => s.name === selected.slice(2)) || null
    : null;
  const present = new Set(settings.subjects.map((s) => subjectKey(s.name)));
  const suggestions = suggested.filter((s) => !present.has(subjectKey(s)));
  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);

  const submitSubject = async (e) => {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name) return;
    setAdding(true);
    const created = await onAddSubject(name);
    setAdding(false);
    if (created) setNewSubject("");
  };

  const toggleDocSubject = (doc, name) => {
    const next = doc.subjects.includes(name) ? doc.subjects.filter((s) => s !== name) : [...doc.subjects, name];
    onSetDocSubjects(doc.id, next);
  };

  const openNode = (id) => {
    if (id.startsWith("d:")) onOpenDoc(id.slice(2));
    else setSelected(id);
  };

  const empty = !docs.length && !settings.subjects.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* Graph */}
      <div className="relative flex-1 min-h-[320px] md:min-h-0 bg-bg/40">
        <BrainGraph nodes={nodes} edges={edges} selectedId={selected} onSelect={setSelected} onOpen={openNode} themeKey={theme} />
        <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
          <div className="inline-flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-surface/90 border border-edge text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" /> Subject
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-surface-2" /> Note
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 border-t border-fg-subtle" /> [[link]]
            </span>
          </div>
          <p className="text-[11px] text-fg-subtle px-1 hidden sm:block">
            Click to select · double-click a note to open · drag to rearrange · scroll to zoom
          </p>
        </div>
        {empty ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <div className="text-center max-w-sm">
              <IconBrain className="w-8 h-8 mx-auto text-primary" />
              <p className="mt-2 text-sm font-semibold text-fg">Your second brain starts here</p>
              <p className="text-xs text-fg-muted">Add subjects on the right and tag your notes with them to grow the graph.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Panel */}
      <aside className="md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-edge overflow-y-auto p-4 space-y-6 max-h-[50%] md:max-h-none [scrollbar-width:thin]">
        {selectedDoc ? (
          <Section
            title="Selected note"
            action={
              <button type="button" onClick={() => setSelected(null)} aria-label="Clear selection" className="p-0.5 rounded text-fg-subtle hover:text-fg">
                <IconX className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="rounded-xl border border-edge bg-surface p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-fg break-words">{selectedDoc.title}</p>
                <p className="text-[11px] text-fg-subtle flex items-center gap-1 mt-0.5">
                  {selectedDoc.folder ? (
                    <>
                      <IconFolder className="w-3 h-3" />
                      <span className="truncate">{folderPathLabel(folderIndex, selectedDoc.folder)}</span>
                      <span>·</span>
                    </>
                  ) : null}
                  <span>{relativeTime(selectedDoc.updatedAt)}</span>
                </p>
                {selectedDoc.preview ? <p className="mt-1.5 text-xs text-fg-muted line-clamp-3">{selectedDoc.preview}</p> : null}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-fg-subtle">Subjects — click to tag or untag</p>
                <div className="flex flex-wrap gap-1.5">
                  {settings.subjects.map((s) => (
                    <SubjectChip
                      key={s.name}
                      name={s.name}
                      color={s.color}
                      size="xs"
                      active={selectedDoc.subjects.includes(s.name)}
                      onClick={() => toggleDocSubject(selectedDoc, s.name)}
                    />
                  ))}
                  {!settings.subjects.length ? <span className="text-xs text-fg-subtle">No subjects yet.</span> : null}
                </div>
              </div>
              {(linkIndex.outgoing.get(selectedDoc.id) || []).length || (linkIndex.backlinks.get(selectedDoc.id) || []).length ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-fg-subtle flex items-center gap-1">
                    <IconLink className="w-3 h-3" /> Links
                  </p>
                  {(linkIndex.outgoing.get(selectedDoc.id) || []).map((id) =>
                    byId.get(id) ? <NoteLine key={`o${id}`} doc={byId.get(id)} hint="links to" onClick={() => setSelected(`d:${id}`)} /> : null,
                  )}
                  {(linkIndex.backlinks.get(selectedDoc.id) || []).map((id) =>
                    byId.get(id) ? <NoteLine key={`b${id}`} doc={byId.get(id)} hint="linked from" onClick={() => setSelected(`d:${id}`)} /> : null,
                  )}
                </div>
              ) : null}
              <ActionButton tone="primary" size="sm" Icon={IconExternal} onClick={() => onOpenDoc(selectedDoc.id)} className="w-full">
                Open note
              </ActionButton>
            </div>
          </Section>
        ) : null}

        {selectedSubject ? (
          <Section
            title="Selected subject"
            action={
              <button type="button" onClick={() => setSelected(null)} aria-label="Clear selection" className="p-0.5 rounded text-fg-subtle hover:text-fg">
                <IconX className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="rounded-xl border border-edge bg-surface p-3 space-y-3">
              <div className="flex items-center gap-2">
                <SubjectDot color={selectedSubject.color} className="w-3 h-3" />
                {renaming === selectedSubject.name ? (
                  <InlineInput
                    value={selectedSubject.name}
                    maxLength={40}
                    className="flex-1 min-w-0"
                    onCommit={async (name) => {
                      setRenaming(null);
                      if (await onRenameSubject(selectedSubject.name, name)) setSelected(`s:${name}`);
                    }}
                    onCancel={() => setRenaming(null)}
                  />
                ) : (
                  <p className="flex-1 min-w-0 text-sm font-semibold text-fg truncate">{selectedSubject.name}</p>
                )}
                <PopoverMenu
                  label={`Options for ${selectedSubject.name}`}
                  items={[
                    { label: "Rename", Icon: IconEdit, onClick: () => setRenaming(selectedSubject.name) },
                    { label: "Show in All notes", Icon: IconNote, onClick: () => onShowSubject(selectedSubject.name) },
                    { divider: true },
                    {
                      label: "Delete subject",
                      Icon: IconTrash,
                      danger: true,
                      onClick: () => {
                        setSelected(null);
                        onDeleteSubject(selectedSubject.name);
                      },
                    },
                  ]}
                />
              </div>
              <div className="space-y-0.5">
                {docs.filter((d) => d.subjects.includes(selectedSubject.name)).map((d) => (
                  <NoteLine key={d.id} doc={d} onClick={() => setSelected(`d:${d.id}`)} />
                ))}
                {!counts.get(selectedSubject.name) ? (
                  <p className="text-xs text-fg-subtle px-2 py-1">No notes carry this subject yet.</p>
                ) : null}
              </div>
              <ActionButton size="sm" Icon={IconNotePlus} onClick={() => onCreateDoc([selectedSubject.name])} className="w-full">
                New note with this subject
              </ActionButton>
            </div>
          </Section>
        ) : null}

        {!selected ? (
          <p className="text-xs text-fg-muted">
            Click a subject or a note in the graph to see its connections. Subjects are the hubs of your second brain; tag notes with them and
            link notes to each other by typing <code className="px-1 rounded bg-surface-2 text-fg">[[Note title]]</code> in the text.
          </p>
        ) : null}

        <Section title="Subjects" count={settings.subjects.length}>
          <form onSubmit={submitSubject} className="flex gap-1.5">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              maxLength={40}
              placeholder="Add a subject…"
              aria-label="New subject"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
            />
            <ActionButton type="submit" tone="primary" size="sm" Icon={IconPlus} disabled={!newSubject.trim()} busy={adding}>
              Add
            </ActionButton>
          </form>
          <div className="space-y-0.5">
            {settings.subjects.map((s) => (
              <div
                key={s.name}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-sm cursor-pointer transition-colors ${
                  selected === `s:${s.name}` ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                }`}
                onClick={() => setSelected(`s:${s.name}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelected(`s:${s.name}`);
                }}
              >
                <SubjectDot color={s.color} />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
                <span className="text-[10px] tabular-nums text-fg-subtle">{counts.get(s.name) || 0}</span>
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  title="Delete subject"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selected === `s:${s.name}`) setSelected(null);
                    onDeleteSubject(s.name);
                  }}
                  className="p-0.5 rounded text-fg-subtle hover:text-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!settings.subjects.length ? <p className="text-xs text-fg-subtle px-2 py-1">No subjects. Add one above or pick a suggestion.</p> : null}
          </div>
        </Section>

        {suggestions.length ? (
          <Section title="Suggestions">
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <Chip key={s} onClick={() => onAddSubject(s)} Icon={IconPlus} disabled={adding}>
                  {s}
                </Chip>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Display">
          <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
            <input type="checkbox" checked={showOrphans} onChange={(e) => setShowOrphans(e.target.checked)} className="accent-[var(--primary)]" />
            Show notes without subjects or links
          </label>
        </Section>
      </aside>
    </div>
  );
}
