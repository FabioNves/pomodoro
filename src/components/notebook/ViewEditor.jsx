"use client";

// Create or edit a saved view: a named list of notes filtered by folder
// and subjects, with its own layout and sort order. Saved views appear in
// the sidebar next to the built-in ones.

import React, { useEffect, useMemo, useState } from "react";
import { SORTS, folderChildren } from "@/lib/notebook/tree";
import {
  ActionButton,
  Field,
  IconGrid,
  IconList,
  IconTrash,
  Modal,
  Segmented,
  SubjectChip,
  inputClass,
} from "@/components/notebook/notebookUi";

export default function ViewEditor({ open, view, folderIndex, subjects, onSave, onDelete, onClose }) {
  const [name, setName] = useState("");
  const [layout, setLayout] = useState("list");
  const [folder, setFolder] = useState("");
  const [picked, setPicked] = useState([]);
  const [sort, setSort] = useState("updated");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(view?.name || "");
    setLayout(view?.layout || "list");
    setFolder(view?.folder || "");
    setPicked(view?.subjects || []);
    setSort(view?.sort || "updated");
    setBusy(false);
  }, [open, view]);

  const folderOptions = useMemo(() => {
    const out = [];
    const visit = (parent, depth) => {
      for (const f of folderChildren(folderIndex, parent)) {
        out.push({ id: f.id, label: `${" ".repeat(depth)}${f.name}` });
        visit(f.id, depth + 1);
      }
    };
    visit(null, 0);
    return out;
  }, [folderIndex]);

  const toggle = (subject) =>
    setPicked((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onSave({ name: name.trim(), layout, folder: folder || null, subjects: picked, sort });
    if (!ok) setBusy(false);
  };

  return (
    <Modal
      open={open}
      title={view ? "Edit view" : "New view"}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <ActionButton tone="danger" size="sm" Icon={IconTrash} onClick={onDelete} className="mr-auto">
              Delete view
            </ActionButton>
          ) : null}
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" onClick={submit} busy={busy} disabled={!name.trim()}>
            {view ? "Save" : "Create view"}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            placeholder="e.g. Work projects"
          />
        </Field>
        <Field label="Layout">
          <Segmented
            label="Layout"
            size="md"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "list", label: "List", Icon: IconList },
              { value: "grid", label: "Grid", Icon: IconGrid },
            ]}
          />
        </Field>
        <Field label="Folder" hint="Notes in this folder and its subfolders.">
          <select className={inputClass} value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {folderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subjects" hint="Leave empty to include every subject; pick several to match any of them.">
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <SubjectChip key={s.name} name={s.name} color={s.color} active={picked.includes(s.name)} onClick={() => toggle(s.name)} />
            ))}
            {!subjects.length ? <span className="text-xs text-fg-subtle">No subjects yet. Add some in the Brain view.</span> : null}
          </div>
        </Field>
        <Field label="Sort by">
          <Segmented label="Sort" size="md" value={sort} onChange={setSort} options={SORTS} />
        </Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
