"use client";

// Folder tree for the sidebar: folders (collapsible, nested) with their
// notes underneath, top-level notes at the bottom. Rows have a "…" menu
// (rename, move, delete, new note/subfolder) and support drag and drop of
// notes and folders onto folders or the top level.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { folderChildren, folderPath, folderSubtreeIds, sortDocs } from "@/lib/notebook/tree";
import MoveDialog from "@/components/notebook/MoveDialog";
import {
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconMove,
  IconNote,
  IconNotePlus,
  IconPin,
  IconTrash,
  InlineInput,
  PopoverMenu,
} from "@/components/notebook/notebookUi";

const DRAG_TYPE = "application/x-notebook";
const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";

function canDrop(e) {
  return Array.from(e.dataTransfer?.types || []).includes(DRAG_TYPE);
}

function FolderNode({ folder, depth, ctx }) {
  const children = folderChildren(ctx.folderIndex, folder.id);
  const notes = ctx.docsIn(folder.id);
  const isOpen = ctx.expanded.has(folder.id);
  const active = ctx.currentFolderId === folder.id && !ctx.openDocId;
  const renaming = ctx.renaming?.kind === "folder" && ctx.renaming.id === folder.id;
  const hasContent = children.length > 0 || notes.length > 0;

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={isOpen}
        aria-selected={active}
        tabIndex={0}
        draggable={!renaming}
        onDragStart={(e) => ctx.dragStart(e, { kind: "folder", id: folder.id })}
        onDragOver={(e) => ctx.dragOver(e, folder.id)}
        onDragLeave={(e) => ctx.dragLeave(e, folder.id)}
        onDrop={(e) => ctx.drop(e, folder.id)}
        onClick={() => ctx.onOpenFolder(folder.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") ctx.onOpenFolder(folder.id);
          if (e.key === "ArrowRight" && !isOpen) ctx.toggle(folder.id);
          if (e.key === "ArrowLeft" && isOpen) ctx.toggle(folder.id);
        }}
        className={`group flex items-center gap-1 rounded-lg pr-1 py-1 text-sm cursor-pointer transition-colors ${
          active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        } ${ctx.dragOverId === folder.id ? "ring-2 ring-focus/60 bg-primary-soft/60" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggle(folder.id);
          }}
          className="p-0.5 rounded text-fg-subtle hover:text-fg"
        >
          {hasContent ? (
            isOpen ? (
              <IconChevronDown className="w-3.5 h-3.5" />
            ) : (
              <IconChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="block w-3.5 h-3.5" />
          )}
        </button>
        {isOpen ? (
          <IconFolderOpen className="w-4 h-4 shrink-0 text-accent" />
        ) : (
          <IconFolder className="w-4 h-4 shrink-0 text-accent" />
        )}
        {renaming ? (
          <InlineInput
            value={folder.name}
            maxLength={120}
            className="flex-1 min-w-0"
            onCommit={(name) => {
              ctx.setRenaming(null);
              ctx.onRenameFolder(folder.id, name);
            }}
            onCancel={() => ctx.setRenaming(null)}
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              ctx.setRenaming({ kind: "folder", id: folder.id });
            }}
          >
            {folder.name}
          </span>
        )}
        {notes.length ? (
          <span className="text-[10px] tabular-nums text-fg-subtle group-hover:hidden">{notes.length}</span>
        ) : null}
        <PopoverMenu
          label={`Options for ${folder.name}`}
          className={menuClass}
          items={[
            { label: "New note here", Icon: IconNotePlus, onClick: () => ctx.onCreateDoc(folder.id) },
            { label: "New subfolder", Icon: IconFolderPlus, onClick: () => ctx.createFolderIn(folder.id) },
            { divider: true },
            { label: "Rename", Icon: IconEdit, onClick: () => ctx.setRenaming({ kind: "folder", id: folder.id }) },
            { label: "Move to…", Icon: IconMove, onClick: () => ctx.setMoving({ kind: "folder", item: folder }) },
            { divider: true },
            { label: "Delete folder", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteFolder(folder) },
          ]}
        />
      </div>
      {isOpen && hasContent ? (
        <div role="group">
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} ctx={ctx} />
          ))}
          {notes.map((note) => (
            <DocRow key={note.id} doc={note} depth={depth + 1} ctx={ctx} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocRow({ doc, depth, ctx }) {
  const active = ctx.openDocId === doc.id;
  const renaming = ctx.renaming?.kind === "doc" && ctx.renaming.id === doc.id;
  return (
    <div
      role="treeitem"
      aria-selected={active}
      tabIndex={0}
      draggable={!renaming}
      onDragStart={(e) => ctx.dragStart(e, { kind: "doc", id: doc.id })}
      onDragOver={(e) => ctx.dragOver(e, doc.folder || null)}
      onDragLeave={(e) => ctx.dragLeave(e, doc.folder || null)}
      onDrop={(e) => ctx.drop(e, doc.folder || null)}
      onClick={() => ctx.onOpenDoc(doc.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") ctx.onOpenDoc(doc.id);
      }}
      className={`group flex items-center gap-1.5 rounded-lg pr-1 py-1 text-sm cursor-pointer transition-colors ${
        active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <IconNote className="w-4 h-4 shrink-0" />
      {renaming ? (
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
      ) : (
        <span
          className="flex-1 min-w-0 truncate"
          onDoubleClick={(e) => {
            e.stopPropagation();
            ctx.setRenaming({ kind: "doc", id: doc.id });
          }}
        >
          {doc.title}
        </span>
      )}
      {doc.pinned ? <IconPin className="w-3 h-3 text-accent shrink-0 group-hover:hidden" /> : null}
      <PopoverMenu
        label={`Options for ${doc.title}`}
        className={menuClass}
        items={[
          { label: doc.pinned ? "Unpin" : "Pin to top", Icon: IconPin, onClick: () => ctx.onTogglePin(doc) },
          { label: "Rename", Icon: IconEdit, onClick: () => ctx.setRenaming({ kind: "doc", id: doc.id }) },
          { label: "Move to…", Icon: IconMove, onClick: () => ctx.setMoving({ kind: "doc", item: doc }) },
          { divider: true },
          { label: "Delete note", Icon: IconTrash, danger: true, onClick: () => ctx.onDeleteDoc(doc) },
        ]}
      />
    </div>
  );
}

/**
 * The ref exposes `createFolder(parentId)`, which creates a folder and
 * starts the inline rename, so buttons outside the tree behave like its menu.
 */
const FolderTree = forwardRef(function FolderTree(
  {
    folders,
    folderIndex,
    docs,
    currentFolderId,
    openDocId,
    onOpenDoc,
    onOpenFolder,
    onCreateDoc,
    onCreateFolder,
    onRenameFolder,
    onMoveFolder,
    onDeleteFolder,
    onRenameDoc,
    onMoveDoc,
    onDeleteDoc,
    onTogglePin,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null); // { kind: "folder" | "doc", id }
  const [moving, setMoving] = useState(null); // { kind, item }
  const [dragOverId, setDragOverId] = useState(null); // folder id, "root" or null

  // Keep the path to the current folder and to the open note expanded.
  const openDocFolder = useMemo(
    () => docs.find((d) => d.id === openDocId)?.folder || null,
    [docs, openDocId],
  );
  useEffect(() => {
    const targets = [currentFolderId, openDocFolder].filter(Boolean);
    if (!targets.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const target of targets) {
        for (const folder of folderPath(folderIndex, target)) {
          if (!next.has(folder.id)) {
            next.add(folder.id);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [currentFolderId, openDocFolder, folderIndex]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const docsIn = (folderId) =>
    sortDocs(
      docs.filter((d) => (d.folder || null) === (folderId || null)),
      "title",
    );

  const createFolderIn = async (parent) => {
    const folder = await onCreateFolder(parent);
    if (!folder) return;
    if (parent) setExpanded((prev) => new Set(prev).add(parent));
    setRenaming({ kind: "folder", id: folder.id });
  };

  useImperativeHandle(ref, () => ({ createFolder: createFolderIn }), [onCreateFolder]);

  /* ── drag and drop ───────────────────────────────────── */

  const dragStart = (e, payload) => {
    e.stopPropagation();
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const dragOver = (e, targetId) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const key = targetId || "root";
    if (dragOverId !== key) setDragOverId(key);
  };

  const dragLeave = (e, targetId) => {
    const key = targetId || "root";
    if (dragOverId === key && !e.currentTarget.contains(e.relatedTarget)) setDragOverId(null);
  };

  const drop = (e, targetId) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    let payload = null;
    try {
      payload = JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || "null");
    } catch {
      payload = null;
    }
    if (!payload) return;
    const target = targetId || null;
    if (payload.kind === "doc") {
      const doc = docs.find((d) => d.id === payload.id);
      if (doc && (doc.folder || null) !== target) onMoveDoc(doc.id, target);
    } else if (payload.kind === "folder") {
      if (payload.id === target) return;
      if (target && folderSubtreeIds(folderIndex, payload.id).has(target)) return;
      const folder = folderIndex.byId.get(payload.id);
      if (folder && (folder.parent || null) !== target) onMoveFolder(folder.id, target);
    }
  };

  const ctx = {
    folderIndex,
    docs,
    docsIn,
    expanded,
    toggle,
    currentFolderId,
    openDocId,
    renaming,
    setRenaming,
    setMoving,
    dragOverId,
    dragStart,
    dragOver,
    dragLeave,
    drop,
    createFolderIn,
    onOpenDoc,
    onOpenFolder,
    onCreateDoc,
    onRenameFolder,
    onDeleteFolder,
    onRenameDoc,
    onDeleteDoc,
    onTogglePin,
  };

  const rootFolders = folderChildren(folderIndex, null);
  const rootDocs = docsIn(null);

  return (
    <>
      <div
        role="tree"
        aria-label="Folders and notes"
        onDragOver={(e) => dragOver(e, null)}
        onDragLeave={(e) => dragLeave(e, null)}
        onDrop={(e) => drop(e, null)}
        className={`space-y-0.5 rounded-lg pb-6 transition-colors ${
          dragOverId === "root" ? "bg-primary-soft/40 ring-2 ring-focus/40" : ""
        }`}
      >
        {rootFolders.map((folder) => (
          <FolderNode key={folder.id} folder={folder} depth={0} ctx={ctx} />
        ))}
        {rootDocs.map((doc) => (
          <DocRow key={doc.id} doc={doc} depth={-1} ctx={ctx} />
        ))}
        {!rootFolders.length && !rootDocs.length ? (
          <p className="px-2 py-3 text-xs text-fg-subtle">
            No notes yet. Use the buttons above to add a note or a folder.
          </p>
        ) : null}
        {folders.length && dragOverId === "root" ? (
          <p className="px-2 py-1 text-[11px] text-fg-subtle">Drop here to move to the top level</p>
        ) : null}
      </div>

      <MoveDialog
        open={!!moving}
        title={moving?.kind === "folder" ? `Move "${moving.item.name}" to…` : moving ? `Move "${moving.item.title}" to…` : ""}
        folderIndex={folderIndex}
        excludeFolderId={moving?.kind === "folder" ? moving.item.id : null}
        currentFolderId={moving ? (moving.kind === "folder" ? moving.item.parent : moving.item.folder) : null}
        onPick={(id) => {
          if (moving?.kind === "folder") onMoveFolder(moving.item.id, id);
          else if (moving) onMoveDoc(moving.item.id, id);
          setMoving(null);
        }}
        onClose={() => setMoving(null)}
      />
    </>
  );
});

export default FolderTree;
