"use client";

// Notebook navigator: search, the views (built-in and saved) and the folder
// tree. Rendered in the left column on desktop and as a slide-over on
// mobile (then `onClose` is set).

import React, { useRef } from "react";
import FolderTree from "@/components/notebook/FolderTree";
import {
  IconBrain,
  IconEdit,
  IconFolder,
  IconFolderPlus,
  IconNote,
  IconNotePlus,
  IconPlus,
  IconPosts,
  IconQuote,
  IconSearch,
  IconTrash,
  IconViews,
  IconX,
  PopoverMenu,
} from "@/components/notebook/notebookUi";

const BUILT_IN_VIEWS = [
  { key: "folders", label: "Folders", Icon: IconFolder },
  { key: "notes", label: "All notes", Icon: IconNote, count: "notes" },
  { key: "brain", label: "Brain", Icon: IconBrain },
  { key: "quotes", label: "Quotes", Icon: IconQuote, count: "quotes" },
  { key: "posts", label: "Saved posts", Icon: IconPosts, count: "posts" },
];

function SectionHeader({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 mb-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

function HeaderButton({ label, Icon, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ViewRow({ active, Icon, label, count, onClick, menu = null }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
        active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {typeof count === "number" ? (
        <span className="text-[10px] tabular-nums text-fg-subtle">{count}</span>
      ) : null}
      {menu ? (
        <PopoverMenu
          label={`Options for ${label}`}
          items={menu}
          className="opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100"
        />
      ) : null}
    </div>
  );
}

export default function NotebookSidebar({
  views,
  activeViewKey,
  counts = { quotes: 0, posts: 0 },
  onSelectView,
  onNewView,
  onEditView,
  onDeleteView,
  folders,
  folderIndex,
  docs,
  currentFolderId,
  openDocId,
  search,
  onSearch,
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
  onClose = null,
}) {
  const treeRef = useRef(null);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-edge space-y-2">
        {onClose ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">Notebook</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        <label className="relative block">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-fg-subtle hover:text-fg"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-4 [scrollbar-width:thin]">
        <section>
          <SectionHeader label="Views">
            <HeaderButton label="New view" Icon={IconPlus} onClick={onNewView} />
          </SectionHeader>
          <div className="space-y-0.5">
            {BUILT_IN_VIEWS.map((v) => (
              <ViewRow
                key={v.key}
                active={activeViewKey === v.key && !openDocId}
                Icon={v.Icon}
                label={v.label}
                count={v.count === "notes" ? docs.length : v.count ? counts[v.count] : undefined}
                onClick={() => onSelectView(v.key)}
              />
            ))}
            {views.map((v) => (
              <ViewRow
                key={v.id}
                active={activeViewKey === `v:${v.id}` && !openDocId}
                Icon={IconViews}
                label={v.name}
                onClick={() => onSelectView(`v:${v.id}`)}
                menu={[
                  { label: "Edit view", Icon: IconEdit, onClick: () => onEditView(v) },
                  { label: "Delete view", Icon: IconTrash, danger: true, onClick: () => onDeleteView(v) },
                ]}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader label="Folders">
            <HeaderButton label="New note" Icon={IconNotePlus} onClick={() => onCreateDoc(null)} />
            <HeaderButton
              label="New folder"
              Icon={IconFolderPlus}
              onClick={() => (treeRef.current ? treeRef.current.createFolder(null) : onCreateFolder(null))}
            />
          </SectionHeader>
          <FolderTree
            ref={treeRef}
            folders={folders}
            folderIndex={folderIndex}
            docs={docs}
            currentFolderId={currentFolderId}
            openDocId={openDocId}
            onOpenDoc={onOpenDoc}
            onOpenFolder={onOpenFolder}
            onCreateDoc={onCreateDoc}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onMoveFolder={onMoveFolder}
            onDeleteFolder={onDeleteFolder}
            onRenameDoc={onRenameDoc}
            onMoveDoc={onMoveDoc}
            onDeleteDoc={onDeleteDoc}
            onTogglePin={onTogglePin}
          />
        </section>
      </div>
    </div>
  );
}
