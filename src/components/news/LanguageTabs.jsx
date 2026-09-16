"use client";

// A row of tabs, one per language, used by the briefing (one tab per edition
// language) and by saved stories. Stories found without a single language
// (worldwide editions and briefings from before editions) sit under
// "International".

import React from "react";
import { languageByCode } from "@/lib/news/locales";
import { Spinner } from "@/components/news/newsUi";

export const ALL_TAB = "__all";

/** "Português", "English", or the fallback for stories with no language. */
export function languageTabLabel(code, emptyLabel = "International") {
  if (code === ALL_TAB) return "All";
  const lang = languageByCode(code);
  return lang ? lang.native : emptyLabel;
}

/**
 * @param {{ tabs: { key: string, label: string, count?: number, busy?: boolean, title?: string }[],
 *   active: string, onChange: (key: string) => void, label?: string }} props
 */
export default function LanguageTabs({ tabs, active, onChange, label = "Languages" }) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key || "_none"}
            type="button"
            role="tab"
            aria-selected={selected}
            title={t.title}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${
              selected
                ? "bg-primary-soft text-primary border-primary/40"
                : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
            }`}
          >
            {t.label}
            {typeof t.count === "number" ? <span className="text-[11px] tabular-nums opacity-70">{t.count}</span> : null}
            {t.busy ? <Spinner className="w-3 h-3" /> : null}
          </button>
        );
      })}
    </div>
  );
}
