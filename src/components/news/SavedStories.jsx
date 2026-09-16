"use client";

// Saved stories, with a tab per language: a reader following several
// countries keeps their Portuguese and French reading apart.

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { newsApi } from "@/lib/news/client";
import { openExternal } from "@/lib/platform";
import { countryName, languageName, sortLanguageKeys } from "@/lib/news/locales";
import LanguageTabs, { ALL_TAB, languageTabLabel } from "@/components/news/LanguageTabs";
import { Chip, EmptyState, IconBookmark, IconExternal, IconX, Spinner, formatDate } from "@/components/news/newsUi";

export default function SavedStories({ refreshKey = 0, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(ALL_TAB);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await newsApi("/api/news/stories/saved");
        if (!cancelled) setItems(data.saved);
      } catch (e) {
        toast.error(e.message || "Could not load saved stories.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const languages = useMemo(
    () => sortLanguageKeys(new Set(items.map((i) => i.language || ""))),
    [items],
  );
  const tabs = useMemo(() => {
    if (languages.length < 2) return [];
    return [
      { key: ALL_TAB, label: "All", count: items.length },
      ...languages.map((key) => ({
        key,
        label: languageTabLabel(key),
        count: items.filter((i) => (i.language || "") === key).length,
      })),
    ];
  }, [languages, items]);

  const active = tabs.some((t) => t.key === tab) ? tab : ALL_TAB;
  const shown = active === ALL_TAB ? items : items.filter((i) => (i.language || "") === active);

  const remove = async (item) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await newsApi("/api/news/stories/saved", { method: "DELETE", body: { storyId: item.storyId } });
      onChanged?.(item.storyId, false);
    } catch (e) {
      setItems(previous);
      toast.error(e.message || "Could not remove the story.");
    }
  };

  if (loading && !items.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading…
      </p>
    );
  }
  if (!items.length) {
    return <EmptyState Icon={IconBookmark} title="No saved stories" hint="Use “Save” on any story in a briefing to keep it here." />;
  }

  return (
    <div className="space-y-4">
      <LanguageTabs tabs={tabs} active={active} onChange={setTab} label="Saved story languages" />

      {shown.length ? (
        <ul className="space-y-3">
          {shown.map((item) => {
            const places = (item.countries || []).map(countryName).filter(Boolean).join(", ");
            const translated = item.language && item.outputLanguage && item.language !== item.outputLanguage;
            return (
              <li key={item.id} className="bg-surface border border-edge rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-fg-subtle">
                      <span className="font-semibold text-fg-muted">{item.publisher || "Source"}</span>
                      {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""} · saved {formatDate(item.savedAt)}
                      {places ? ` · ${places}` : ""}
                      {translated ? ` · translated from ${languageName(item.language)}` : ""}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-fg leading-snug">
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          openExternal(item.url);
                        }}
                        className="hover:text-primary transition-colors"
                      >
                        {item.headline}
                      </a>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="shrink-0 p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-surface-hover transition-colors"
                    aria-label="Remove saved story"
                    title="Remove"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{item.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openExternal(item.url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-primary/40 bg-primary-soft text-primary text-xs font-medium hover:bg-primary hover:text-primary-fg transition-colors"
                  >
                    <IconExternal className="w-3 h-3" />
                    Open source
                  </button>
                  {item.topics?.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState Icon={IconBookmark} title="Nothing saved in this language" hint="Switch tabs to see your other saved stories." />
      )}
    </div>
  );
}
