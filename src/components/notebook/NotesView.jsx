"use client";

// Note lists: the contents of a folder (Folders view), every note (All
// notes, filterable by subject), a saved view, or search results. Cards in
// a grid or compact rows, sorted the way the user asked.

import React, { useEffect, useMemo, useState } from "react";
import { notebookApi } from "@/lib/notebook/client";
import {
  SORTS,
  docMatchesQuery,
  folderChildren,
  folderPath,
  folderPathLabel,
  folderSubtreeIds,
  sortDocs,
} from "@/lib/notebook/tree";
import MoveDialog from "@/components/notebook/MoveDialog";
import {
  ActionButton,
  EmptyState,
  IconChevronRight,
  IconEdit,
  IconFolder,
  IconFolderPlus,
  IconGrid,
  IconList,
  IconMove,
  IconNote,
  IconNotePlus,
  IconPin,
  IconSearch,
  IconTabs,
  IconTrash,
  IconViews,
  InlineInput,
  PopoverMenu,
  Segmented,
  SubjectChip,
  relativeTime,
} from "@/components/notebook/notebookUi";

const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";

/** Small per-browser preference (layout, sort) for the built-in views. */
function usePref(key, initial) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(saved);
    } catch {
      /* private mode etc. */
    }
  }, [key]);
  const set = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}

function noteMenu(doc, ctx) {
  return [
    { label: doc.pinned ? "Unpin" : "Pin to top", Icon: IconPin, onClick: () => ctx.onTogglePin(doc) },
    { label: "Rename", Icon: IconEdit, onClick: () => ctx.setRenaming(doc.id) },
    { label: "Move to…", Icon: IconMove, onClick: () => ctx.setMoving(doc) },
    { divider: true },
    { label: "Delete note", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteDoc(doc) },
  ];
}

function NoteMeta({ doc, ctx }) {
  const path = ctx.showFolder ? folderPathLabel(ctx.folderIndex, doc.folder) : "";
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-fg-subtle">
      {path ? (
        <span className="inline-flex items-center gap-1 min-w-0 max-w-[14rem]">
          <IconFolder className="w-3 h-3 shrink-0" />
          <span className="truncate">{path}</span>
        </span>
      ) : null}
      <span>{relativeTime(doc.updatedAt)}</span>
      {doc.tabCount > 1 ? (
        <span className="inline-flex items-center gap-1">
          <IconTabs className="w-3 h-3" />
          {doc.tabCount} tabs
        </span>
      ) : null}
      <span className="tabular-nums">{doc.wordCount} words</span>
    </div>
  );
}

function Subjects({ doc, ctx }) {
  if (!doc.subjects?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {doc.subjects.map((s) => (
        <SubjectChip key={s} name={s} color={ctx.colorOf.get(s)} size="xs" />
      ))}
    </div>
  );
}

function Title({ doc, ctx, className }) {
  if (ctx.renaming === doc.id) {
    return (
      <InlineInput
        value={doc.title}
        maxLength={200}
        className="flex-1 min-w-0"
        onCommit={(title) => {
          ctx.setRenaming(null);
          ctx.onRenameDoc(doc.id, title);
        }}
        onCancel={() => ctx.setRenaming(null)}
      />
    );
  }
  return <h3 className={className}>{doc.title}</h3>;
}

function NoteCard({ doc, ctx }) {
  const renaming = ctx.renaming === doc.id;
  const open = () => !renaming && ctx.onOpenDoc(doc.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group text-left rounded-xl border border-edge bg-surface hover:border-edge-strong hover:shadow-md transition-all p-3.5 flex flex-col gap-2 cursor-pointer min-h-[9.5rem]"
    >
      <div className="flex items-start gap-2">
        <IconNote className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <Title doc={doc} ctx={ctx} className="flex-1 min-w-0 text-sm font-semibold text-fg truncate" />
        {doc.pinned ? <IconPin className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" /> : null}
        <PopoverMenu label={`Options for ${doc.title}`} items={noteMenu(doc, ctx)} className={`${menuClass} -mr-1 -mt-0.5`} />
      </div>
      <p className="text-xs text-fg-muted line-clamp-3 flex-1 break-words">
        {ctx.snippets.get(doc.id) || doc.preview || <span className="italic text-fg-subtle">Empty note</span>}
      </p>
      <Subjects doc={doc} ctx={ctx} />
      <NoteMeta doc={doc} ctx={ctx} />
    </div>
  );
}

function NoteRow({ doc, ctx }) {
  const renaming = ctx.renaming === doc.id;
  const open = () => !renaming && ctx.onOpenDoc(doc.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group flex items-start gap-3 rounded-xl border border-edge bg-surface hover:border-edge-strong hover:shadow-sm transition-all px-3.5 py-3 cursor-pointer"
    >
      <IconNote className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Title doc={doc} ctx={ctx} className="flex-1 min-w-0 text-sm font-semibold text-fg truncate" />
          {doc.pinned ? <IconPin className="w-3.5 h-3.5 text-accent shrink-0" /> : null}
        </div>
        <p className="text-xs text-fg-muted line-clamp-2 break-words">
          {ctx.snippets.get(doc.id) || doc.preview || <span className="italic text-fg-subtle">Empty note</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Subjects doc={doc} ctx={ctx} />
          <NoteMeta doc={doc} ctx={ctx} />
        </div>
      </div>
      <PopoverMenu label={`Options for ${doc.title}`} items={noteMenu(doc, ctx)} className={`${menuClass} -mr-1`} />
    </div>
  );
}

function FolderCard({ folder, ctx }) {
  const count = ctx.docs.filter((d) => d.folder === folder.id).length;
  const sub = folderChildren(ctx.folderIndex, folder.id).length;
  const renaming = ctx.renamingFolder === folder.id;
  const open = () => !renaming && ctx.onOpenFolder(folder.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group flex items-center gap-2.5 rounded-xl border border-edge bg-surface hover:border-edge-strong hover:shadow-md transition-all px-3 py-2.5 cursor-pointer"
    >
      <IconFolder className="w-5 h-5 text-accent shrink-0" />
      {renaming ? (
        <InlineInput
          value={folder.name}
          maxLength={120}
          className="flex-1 min-w-0"
          onCommit={(name) => {
            ctx.setRenamingFolder(null);
            ctx.onRenameFolder(folder.id, name);
          }}
          onCancel={() => ctx.setRenamingFolder(null)}
        />
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{folder.name}</p>
          <p className="text-[11px] text-fg-subtle">
            {count} note{count === 1 ? "" : "s"}
            {sub ? ` · ${sub} subfolder${sub === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      )}
      <PopoverMenu
        label={`Options for ${folder.name}`}
        className={menuClass}
        items={[
          { label: "Rename", Icon: IconEdit, onClick: () => ctx.setRenamingFolder(folder.id) },
          { label: "Delete folder", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteFolder(folder) },
        ]}
      />
    </div>
  );
}

function describeView(view, folderIndex) {
  const parts = [];
  if (view.folder) {
    const folder = folderIndex.byId.get(view.folder);
    parts.push(folder ? `in “${folder.name}”` : "in a deleted folder");
  }
  if (view.subjects?.length) parts.push(`tagged ${view.subjects.join(", ")}`);
  return parts.length ? `Notes ${parts.join(" and ")}.` : "Every note.";
}

export default function NotesView({
  mode,
  view,
  folderId,
  docs,
  folders,
  folderIndex,
  settings,
  search,
  onClearSearch,
  subjectFilter,
  onSubjectFilter,
  onOpenDoc,
  onOpenFolder,
  onCreateDoc,
  onCreateFolder,
  onRenameDoc,
  onMoveDoc,
  onDeleteDoc,
  onTogglePin,
  onRenameFolder,
  onDeleteFolder,
  onEditView,
}) {
  const [layoutPref, setLayoutPref] = usePref("notebook:layout", "grid");
  const [sortPref, setSortPref] = usePref("notebook:sort", "updated");
  const [renaming, setRenaming] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [moving, setMoving] = useState(null);
  const [results, setResults] = useState(null);

  const query = search.trim();
  const searching = query.length > 0;
  const layout = view ? view.layout : layoutPref;
  const sort = view ? view.sort : sortPref;

  // Local matches are instant; the server adds notes whose contents match.
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await notebookApi(`/api/notebook/search?q=${encodeURIComponent(query)}`);
        if (!cancelled) setResults(data.results);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const colorOf = useMemo(() => new Map(settings.subjects.map((s) => [s.name, s.color])), [settings.subjects]);
  const currentFolder = folderId ? folderIndex.byId.get(folderId) || null : null;
  const viewSubtree = useMemo(
    () => (view?.folder ? folderSubtreeIds(folderIndex, view.folder) : null),
    [view, folderIndex],
  );

  const { title, subtitle, list, snippets, subfolders, showFolder } = useMemo(() => {
    const snippets = new Map();
    const count = (n) => `${n} note${n === 1 ? "" : "s"}`;
    if (searching) {
      const local = docs.filter((d) => docMatchesQuery(d, query));
      const extra = (results || []).filter((r) => !local.some((l) => l.id === r.id));
      for (const r of results || []) if (r.snippet) snippets.set(r.id, r.snippet);
      const list = sortDocs([...local, ...extra], sort);
      return {
        title: `Results for “${query}”`,
        subtitle: results === null && query.length >= 2 ? "Searching note contents…" : count(list.length),
        list,
        snippets,
        subfolders: [],
        showFolder: true,
      };
    }
    if (mode === "notes") {
      const filtered = subjectFilter ? docs.filter((d) => d.subjects.includes(subjectFilter)) : docs;
      return {
        title: subjectFilter || "All notes",
        subtitle: subjectFilter ? `${count(filtered.length)} with this subject` : count(filtered.length),
        list: sortDocs(filtered, sort),
        snippets,
        subfolders: [],
        showFolder: true,
      };
    }
    if (mode === "custom" && view) {
      const filtered = docs.filter(
        (d) =>
          (!viewSubtree || (d.folder && viewSubtree.has(d.folder))) &&
          (!view.subjects.length || view.subjects.some((s) => d.subjects.includes(s))),
      );
      return {
        title: view.name,
        subtitle: `${describeView(view, folderIndex)} ${count(filtered.length)}.`,
        list: sortDocs(filtered, sort),
        snippets,
        subfolders: [],
        showFolder: true,
      };
    }
    const inFolder = docs.filter((d) => (d.folder || null) === (folderId || null));
    const children = folderChildren(folderIndex, folderId || null);
    return {
      title: currentFolder ? currentFolder.name : "Folders",
      subtitle: `${children.length ? `${children.length} folder${children.length === 1 ? "" : "s"} · ` : ""}${count(inFolder.length)}`,
      list: sortDocs(inFolder, sort),
      snippets,
      subfolders: children,
      showFolder: false,
    };
  }, [searching, query, results, docs, sort, mode, subjectFilter, view, viewSubtree, folderIndex, folderId, currentFolder]);

  const newNote = () => {
    if (mode === "custom" && view) return onCreateDoc(view.folder || null, view.subjects || []);
    if (mode === "notes") return onCreateDoc(null, subjectFilter ? [subjectFilter] : []);
    return onCreateDoc(folderId || null, []);
  };

  const newFolder = async () => {
    const folder = await onCreateFolder(folderId || null);
    if (folder) setRenamingFolder(folder.id);
  };

  const ctx = {
    docs,
    folderIndex,
    colorOf,
    snippets,
    showFolder,
    renaming,
    setRenaming,
    renamingFolder,
    setRenamingFolder,
    setMoving,
    onOpenDoc,
    onOpenFolder,
    onRenameDoc,
    onDeleteDoc,
    onTogglePin,
    onRenameFolder,
    onDeleteFolder,
  };

  const breadcrumb = mode === "folders" && !searching ? folderPath(folderIndex, folderId) : [];
  const HeaderIcon = searching ? IconSearch : mode === "custom" ? IconViews : mode === "notes" ? IconNote : IconFolder;

  return (
    <>
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-edge flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            {breadcrumb.length ? (
              <nav aria-label="Folder path" className="flex items-center gap-1 text-xs text-fg-subtle mb-0.5 flex-wrap">
                <button type="button" onClick={() => onOpenFolder(null)} className="hover:text-fg transition-colors">
                  Folders
                </button>
                {breadcrumb.map((f, i) => (
                  <React.Fragment key={f.id}>
                    <IconChevronRight className="w-3 h-3" />
                    {i === breadcrumb.length - 1 ? (
                      <span className="text-fg-muted">{f.name}</span>
                    ) : (
                      <button type="button" onClick={() => onOpenFolder(f.id)} className="hover:text-fg transition-colors">
                        {f.name}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h2 className="flex items-center gap-2 text-lg font-semibold text-fg truncate">
              <HeaderIcon className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">{title}</span>
            </h2>
            <p className="text-xs text-fg-muted">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {searching ? (
              <ActionButton size="sm" onClick={onClearSearch}>
                Clear search
              </ActionButton>
            ) : null}
            {mode === "custom" && view && !searching ? (
              <ActionButton size="sm" Icon={IconEdit} onClick={() => onEditView(view)}>
                Edit view
              </ActionButton>
            ) : null}
            {mode === "folders" && !searching ? (
              <ActionButton size="sm" Icon={IconFolderPlus} onClick={newFolder}>
                New folder
              </ActionButton>
            ) : null}
            <ActionButton size="sm" tone="primary" Icon={IconNotePlus} onClick={newNote}>
              New note
            </ActionButton>
            {!view ? (
              <>
                <Segmented
                  label="Sort"
                  value={sort}
                  onChange={setSortPref}
                  options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                />
                <Segmented
                  label="Layout"
                  value={layout}
                  onChange={setLayoutPref}
                  options={[
                    { value: "grid", label: "Grid", Icon: IconGrid },
                    { value: "list", label: "List", Icon: IconList },
                  ]}
                />
              </>
            ) : null}
          </div>
        </div>

        {mode === "notes" && !searching && settings.subjects.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSubjectFilter(null)}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                !subjectFilter ? "bg-primary-soft border-primary/40 text-primary" : "bg-surface-2 border-edge text-fg-muted hover:text-fg"
              }`}
            >
              All subjects
            </button>
            {settings.subjects.map((s) => (
              <SubjectChip
                key={s.name}
                name={s.name}
                color={s.color}
                active={subjectFilter === s.name}
                onClick={() => onSubjectFilter(subjectFilter === s.name ? null : s.name)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 [scrollbar-width:thin]">
        {mode === "folders" && folderId && !currentFolder && !searching ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-warning/40 bg-warning-soft text-warning text-sm">
            <span>This folder no longer exists.</span>
            <ActionButton size="sm" onClick={() => onOpenFolder(null)}>
              Back to Folders
            </ActionButton>
          </div>
        ) : null}

        {subfolders.length ? (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Folders</p>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {subfolders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} ctx={ctx} />
              ))}
            </div>
          </section>
        ) : null}

        {list.length ? (
          <section className="space-y-2">
            {subfolders.length ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Notes</p>
            ) : null}
            {layout === "grid" ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((doc) => (
                  <NoteCard key={doc.id} doc={doc} ctx={ctx} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((doc) => (
                  <NoteRow key={doc.id} doc={doc} ctx={ctx} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <EmptyState
            Icon={searching ? IconSearch : IconNote}
            title={
              searching
                ? results === null && query.length >= 2
                  ? "Searching…"
                  : "No notes match"
                : mode === "folders" && !subfolders.length
                  ? currentFolder
                    ? "This folder is empty"
                    : "Your notebook is empty"
                  : "No notes here yet"
            }
            hint={
              searching
                ? "Try another word. Titles, subjects and note contents are searched."
                : mode === "custom"
                  ? "Notes matching this view's folder and subjects show up here."
                  : "Create a note to start writing. Each note can have tabs and subtabs."
            }
            action={
              !searching ? (
                <ActionButton tone="primary" Icon={IconNotePlus} onClick={newNote}>
                  New note
                </ActionButton>
              ) : null
            }
          />
        )}
      </div>

      <MoveDialog
        open={!!moving}
        title={moving ? `Move "${moving.title}" to…` : ""}
        folderIndex={folderIndex}
        currentFolderId={moving?.folder || null}
        onPick={(id) => {
          if (moving) onMoveDoc(moving.id, id);
          setMoving(null);
        }}
        onClose={() => setMoving(null)}
      />
    </>
  );
}
