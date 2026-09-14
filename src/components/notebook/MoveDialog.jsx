"use client";

// "Move to…" picker: the top level plus every folder, indented by depth.
// When moving a folder, the folder itself and its subfolders are left out.

import React, { useMemo } from "react";
import { folderChildren, folderSubtreeIds } from "@/lib/notebook/tree";
import { ActionButton, IconCheck, IconFolder, IconNotebook, Modal } from "@/components/notebook/notebookUi";

export default function MoveDialog({
  open,
  title = "Move to…",
  folderIndex,
  excludeFolderId = null,
  currentFolderId = null,
  onPick,
  onClose,
}) {
  const rows = useMemo(() => {
    if (!open) return [];
    const excluded = excludeFolderId ? folderSubtreeIds(folderIndex, excludeFolderId) : new Set();
    const out = [];
    const visit = (parentId, depth) => {
      for (const folder of folderChildren(folderIndex, parentId)) {
        if (excluded.has(folder.id)) continue;
        out.push({ folder, depth });
        visit(folder.id, depth + 1);
      }
    };
    visit(null, 0);
    return out;
  }, [open, folderIndex, excludeFolderId]);

  const Row = ({ id, label, depth, Icon }) => {
    const current = (currentFolderId || null) === (id || null);
    return (
      <button
        type="button"
        onClick={() => onPick(id)}
        disabled={current}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors disabled:cursor-default ${
          current ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        }`}
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {current ? <IconCheck className="w-4 h-4" /> : null}
      </button>
    );
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={<ActionButton onClick={onClose}>Cancel</ActionButton>}
    >
      <div className="space-y-0.5 -mx-1">
        <Row id={null} label="Top level" depth={0} Icon={IconNotebook} />
        {rows.map(({ folder, depth }) => (
          <Row key={folder.id} id={folder.id} label={folder.name} depth={depth + 1} Icon={IconFolder} />
        ))}
      </div>
      {!rows.length ? (
        <p className="mt-3 text-xs text-fg-subtle">No other folders yet. Create one from the sidebar.</p>
      ) : null}
    </Modal>
  );
}
