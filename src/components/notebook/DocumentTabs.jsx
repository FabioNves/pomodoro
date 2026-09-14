"use client";

// The tabs of one note, as an outline: top-level tabs with their subtabs
// nested underneath (up to three levels). Rows have a "…" menu to rename,
// add a subtab, reorder, nest or un-nest, and delete.

import React, { useState } from "react";
import { MAX_TAB_LEVELS, orderedTabs, tabChildren } from "@/lib/notebook/tree";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconIndent,
  IconOutdent,
  IconPlus,
  IconTabs,
  IconTrash,
  IconX,
  InlineInput,
  PopoverMenu,
} from "@/components/notebook/notebookUi";

export default function DocumentTabs({ tabs, activeTabId, onSelect, onAdd, onRename, onMove, onDelete, onClose = null, className = "" }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null);

  const ordered = orderedTabs(tabs);
  const hidden = new Set();
  const visible = [];
  for (const tab of ordered) {
    if (tab.parent && hidden.has(tab.parent)) {
      hidden.add(tab.id);
      continue;
    }
    visible.push(tab);
    if (collapsed.has(tab.id)) hidden.add(tab.id);
  }

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const menuFor = (tab) => {
    const siblings = tabChildren(tabs, tab.parent);
    const index = siblings.findIndex((s) => s.id === tab.id);
    const previous = index > 0 ? siblings[index - 1] : null;
    const parent = tab.parent ? tabs.find((t) => t.id === tab.parent) : null;
    const parentSiblings = parent ? tabChildren(tabs, parent.parent) : [];
    const parentIndex = parent ? parentSiblings.findIndex((s) => s.id === parent.id) : -1;
    const canNest = tab.depth < MAX_TAB_LEVELS - 1;
    return [
      { label: "Rename", Icon: IconEdit, onClick: () => setRenaming(tab.id) },
      { label: "Add subtab", Icon: IconPlus, disabled: !canNest, onClick: () => onAdd(tab.id) },
      { divider: true },
      { label: "Move up", Icon: IconArrowUp, disabled: index <= 0, onClick: () => onMove(tab.id, { order: index - 1 }) },
      {
        label: "Move down",
        Icon: IconArrowDown,
        disabled: index >= siblings.length - 1,
        onClick: () => onMove(tab.id, { order: index + 1 }),
      },
      {
        label: "Nest under previous tab",
        Icon: IconIndent,
        disabled: !previous || !canNest,
        onClick: () => previous && onMove(tab.id, { parent: previous.id }),
      },
      {
        label: "Move out one level",
        Icon: IconOutdent,
        disabled: !parent,
        onClick: () => parent && onMove(tab.id, { parent: parent.parent || null, order: parentIndex + 1 }),
      },
      { divider: true },
      { label: "Delete tab", Icon: IconTrash, danger: true, disabled: tabs.length <= 1, onClick: () => onDelete(tab) },
    ];
  };

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          <IconTabs className="w-3.5 h-3.5" />
          Tabs
          <span className="tabular-nums">({tabs.length})</span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Add tab"
            aria-label="Add tab"
            onClick={() => onAdd(null)}
            className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
          >
            <IconPlus className="w-4 h-4" />
          </button>
          {onClose ? (
            <button
              type="button"
              aria-label="Hide tabs"
              onClick={onClose}
              className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
            >
              <IconX className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div role="tree" aria-label="Document tabs" className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5 [scrollbar-width:thin]">
        {visible.map((tab) => {
          const kids = tabChildren(tabs, tab.id).length;
          const active = tab.id === activeTabId;
          const isCollapsed = collapsed.has(tab.id);
          return (
            <div
              key={tab.id}
              role="treeitem"
              aria-selected={active}
              aria-expanded={kids ? !isCollapsed : undefined}
              tabIndex={0}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(tab.id);
              }}
              className={`group flex items-center gap-1 rounded-lg pr-1 py-1.5 text-sm cursor-pointer transition-colors ${
                active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
              style={{ paddingLeft: `${tab.depth * 14 + 6}px` }}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label={isCollapsed ? "Show subtabs" : "Hide subtabs"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (kids) toggle(tab.id);
                }}
                className={`p-0.5 rounded text-fg-subtle ${kids ? "hover:text-fg" : "pointer-events-none"}`}
              >
                {kids ? (
                  isCollapsed ? (
                    <IconChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <IconChevronDown className="w-3.5 h-3.5" />
                  )
                ) : (
                  <span className="block w-3.5 h-3.5" />
                )}
              </button>
              {renaming === tab.id ? (
                <InlineInput
                  value={tab.title}
                  maxLength={120}
                  className="flex-1 min-w-0"
                  onCommit={(title) => {
                    setRenaming(null);
                    onRename(tab.id, title);
                  }}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenaming(tab.id);
                  }}
                >
                  {tab.title}
                </span>
              )}
              <PopoverMenu
                label={`Options for ${tab.title}`}
                items={menuFor(tab)}
                className="opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100"
              />
            </div>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-edge">
        <button
          type="button"
          onClick={() => onAdd(null)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Add tab
        </button>
      </div>
    </div>
  );
}
