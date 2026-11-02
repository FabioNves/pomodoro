"use client";

// The budget's categories by type: rename any of them, add your own, remove
// one (its entries move to the type's Other, which always stays).

import React, { useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import { BUDGET_LIMITS, ENTRY_TYPES, categoriesOf, isFallbackCategory } from "@/lib/budget/categories";
import {
  ActionButton,
  Banner,
  ChoiceButtons,
  IconPlus,
  IconTrash,
  TYPE_TEXT,
  inputClass,
} from "@/components/budget/budgetUi";

function CategoryRow({ category, onRename, onRemove }) {
  const [label, setLabel] = useState(category.label);
  const [busy, setBusy] = useState(false);
  const commit = async () => {
    const next = label.trim();
    if (!next || next === category.label) {
      setLabel(category.label);
      return;
    }
    setBusy(true);
    const ok = await onRename(category, next);
    if (!ok) setLabel(category.label);
    setBusy(false);
  };
  return (
    <li className="flex items-center gap-2">
      <input
        className={`${inputClass} flex-1`}
        value={label}
        maxLength={BUDGET_LIMITS.categoryLabel}
        disabled={busy}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setLabel(category.label);
        }}
        aria-label={`Rename ${category.label}`}
      />
      {category.custom ? <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Yours</span> : null}
      <button
        type="button"
        onClick={() => onRemove(category)}
        disabled={busy || isFallbackCategory(category.key)}
        className="p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger-soft disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-subtle"
        title={isFallbackCategory(category.key) ? "Every type keeps its Other category" : `Remove ${category.label}`}
        aria-label={`Remove ${category.label}`}
      >
        <IconTrash className="w-4 h-4" />
      </button>
    </li>
  );
}

export default function CategoriesDialog({ open, categories, onClose, onAdd, onRename, onRemove }) {
  const [type, setType] = useState("expense");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const list = categoriesOf(categories, type);

  const guard = (fn) => async (...args) => {
    setError(null);
    try {
      await fn(...args);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!label.trim() || busy) return;
    setBusy(true);
    const ok = await guard(onAdd)(label.trim(), type);
    setBusy(false);
    if (ok) setLabel("");
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Categories" subtitle="Rename, add or remove" bodyClassName="px-5 py-4">
      <div className="space-y-4">
        <ChoiceButtons
          value={type}
          onChange={setType}
          label="Type"
          options={ENTRY_TYPES.map((t) => ({ value: t.key, label: t.plural, textClass: TYPE_TEXT[t.key] }))}
        />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <ul className="space-y-2" data-testid="budget-categories">
          {list.map((c) => (
            <CategoryRow
              key={c.key}
              category={c}
              onRename={guard(onRename)}
              onRemove={async (category) => {
                if (window.confirm(`Remove ${category.label}? Its entries move to Other.`)) await guard(onRemove)(category);
              }}
            />
          ))}
        </ul>
        <form onSubmit={add} className="flex items-center gap-2 pt-2 border-t border-edge">
          <input
            className={`${inputClass} flex-1`}
            placeholder={`New ${ENTRY_TYPES.find((t) => t.key === type)?.label.toLowerCase()} category`}
            value={label}
            maxLength={BUDGET_LIMITS.categoryLabel}
            onChange={(e) => setLabel(e.target.value)}
          />
          <ActionButton type="submit" tone="primary" Icon={IconPlus} disabled={!label.trim()} busy={busy}>
            Add
          </ActionButton>
        </form>
      </div>
    </ModalShell>
  );
}
