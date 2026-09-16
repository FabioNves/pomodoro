"use client";

// "Generate now", with a menu to build every edition of the briefing or just
// one of them — refreshing the Portugal edition should not rebuild the other
// seven. With fewer than two editions there is nothing to choose, so it is a
// plain button.

import React, { useEffect, useRef, useState } from "react";
import { countryName, languageName } from "@/lib/news/locales";
import { ActionButton, IconChevronDown, IconSparkles, Spinner } from "@/components/news/newsUi";

function editionLabel(edition) {
  const places = (edition.countries || []).map(countryName).filter(Boolean);
  return places.length ? places.join(", ") : "Worldwide";
}

function editionHint(edition) {
  const bits = [edition.coverage === "top" ? "top news" : "your topics"];
  if (edition.language) bits.push(languageName(edition.language));
  if (edition.output && edition.output !== "source") bits.push(`in ${languageName(edition.output)}`);
  return bits.join(" · ");
}

export default function GenerateMenu({ editions = [], kind, busy, onGenerate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (keys) => {
    setOpen(false);
    onGenerate(keys);
  };

  if (editions.length < 2) {
    return (
      <ActionButton
        tone="primary"
        Icon={IconSparkles}
        onClick={() => run(null)}
        busy={busy}
        title={`Generate a ${kind} briefing now`}
      >
        Generate now
      </ActionButton>
    );
  }

  const item =
    "w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50";

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex rounded-lg shadow-md shadow-primary/25 overflow-hidden">
        <button
          type="button"
          onClick={() => run(null)}
          disabled={busy}
          title={`Generate all ${editions.length} editions of your ${kind} briefing`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
        >
          {busy ? <Spinner className="w-3.5 h-3.5" /> : <IconSparkles className="w-3.5 h-3.5" />}
          Generate now
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Choose which editions to generate"
          className="px-2 bg-primary hover:bg-primary-hover text-primary-fg border-l border-primary-fg/25 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
        >
          <IconChevronDown className="w-4 h-4" />
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          aria-label="Editions to generate"
          className="absolute right-0 z-30 mt-1 w-64 max-h-80 overflow-y-auto rounded-xl border border-edge bg-surface shadow-lg p-1"
        >
          <button role="menuitem" type="button" onClick={() => run(null)} className={item}>
            <p className="text-sm font-semibold text-fg">All editions</p>
            <p className="text-[11px] text-fg-subtle">{editions.length} editions, built one after another</p>
          </button>
          <div className="my-1 border-t border-edge" />
          <p className="px-2.5 py-1 text-[11px] uppercase tracking-wide text-fg-subtle">Just one</p>
          {editions.map((edition) => (
            <button key={edition.key} role="menuitem" type="button" onClick={() => run([edition.key])} className={item}>
              <p className="text-sm font-medium text-fg truncate">{editionLabel(edition)}</p>
              <p className="text-[11px] text-fg-subtle truncate">{editionHint(edition)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
