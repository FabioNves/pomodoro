"use client";

// Stories tab: the news hub's daily and weekly stories (written every
// morning in movez-studio from the hub's publisher feeds), one tab per
// edition (its language and regions), kept to the hub topics the reader
// follows. Each story can be translated into the reader's language and
// saved; nothing else is stored here. Server: /api/news/hub.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { newsApi } from "@/lib/news/client";
import { openExternal } from "@/lib/platform";
import { countryName, languageName } from "@/lib/news/locales";
import LanguageTabs, { languageTabLabel } from "@/components/news/LanguageTabs";
import {
  Chip,
  Spinner,
  EmptyState,
  Banner,
  IconBookmark,
  IconExternal,
  IconGlobe,
  IconTrend,
  formatDate,
} from "@/components/news/newsUi";

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "Last week" },
];

function editionLabel(e) {
  const where = e.countries.length ? e.countries.map(countryName).join(", ") : "";
  return where ? `${languageTabLabel(e.language)} · ${where}` : languageTabLabel(e.language);
}

function HubStoryCard({ story, rank, language, saved, onSaved }) {
  const [translation, setTranslation] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [busy, setBusy] = useState("");
  const canTranslate = story.language && story.language !== language;
  const text = showTranslation && translation ? translation : story;

  const translate = async () => {
    if (translation) return setShowTranslation((v) => !v);
    setBusy("translate");
    try {
      setTranslation(await newsApi("/api/news/hub/translate", { method: "POST", body: { storyId: story.id, language } }));
      setShowTranslation(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const toggleSave = async () => {
    setBusy("save");
    try {
      if (saved) await newsApi("/api/news/stories/saved", { method: "DELETE", body: { storyId: story.id } });
      else await newsApi("/api/news/stories/saved", { method: "POST", body: { storyId: story.id, hub: true } });
      onSaved(story.id, !saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const primary = story.sources[0];
  return (
    <article className="bg-surface border border-edge rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-primary-soft text-primary text-xs font-bold flex items-center justify-center tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-subtle">
            <span className="font-semibold text-fg-muted">{primary?.publisher || "Source"}</span>
            {story.coverage > 1 ? <span>· {story.coverage} outlets</span> : null}
            {primary?.publishedAt ? <span>· {formatDate(primary.publishedAt)}</span> : null}
            {story.countries.length ? <span>· {story.countries.map(countryName).join(", ")}</span> : null}
            {showTranslation ? <span className="text-accent">· translated from {languageName(story.language)}</span> : null}
          </p>
          <h3 className="mt-1 text-base sm:text-lg font-semibold text-fg leading-snug">{text.headline}</h3>
        </div>
      </div>
      <p className="mt-2.5 text-sm text-fg leading-relaxed">{text.summary}</p>
      {text.whyItMatters ? (
        <div className="mt-2.5 rounded-lg bg-surface-2 border border-edge px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-fg-subtle">Why it matters</p>
          <p className="mt-0.5 text-sm text-fg-muted leading-relaxed">{text.whyItMatters}</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {story.sources.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => openExternal(s.url)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-edge text-xs text-fg-muted hover:text-fg hover:border-edge-strong transition-colors max-w-[220px]"
            title={s.title || s.url}
          >
            <IconExternal className="w-3 h-3 shrink-0" />
            <span className="truncate">{s.publisher || s.domain}</span>
          </button>
        ))}
        <span className="flex-1" />
        {canTranslate ? (
          <Chip onClick={translate} disabled={Boolean(busy)} tone={showTranslation ? "primary" : "neutral"} Icon={IconGlobe}>
            {busy === "translate" ? "Translating…" : showTranslation ? "Original" : `Translate to ${languageName(language)}`}
          </Chip>
        ) : null}
        <Chip onClick={toggleSave} disabled={Boolean(busy)} tone={saved ? "primary" : "neutral"} Icon={IconBookmark}>
          {saved ? "Saved" : "Save"}
        </Chip>
      </div>
    </article>
  );
}

export default function HubStories({ onSavedChanged }) {
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("");
  const [saved, setSaved] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await newsApi(`/api/news/hub?period=${period}`);
      setData(d);
      setSaved(new Set(d.saved || []));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  const editions = data?.editions || [];
  const edition = editions.find((e) => e.key === active) || editions[0];
  const followed = useMemo(() => new Set(data?.followed || []), [data]);

  const toggleTopic = async (key) => {
    const next = followed.has(key) ? [...followed].filter((k) => k !== key) : [...followed, key];
    try {
      await newsApi("/api/news/preferences", { method: "PUT", body: { hubTopics: next } });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onSaved = (id, isSaved) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(id);
      else next.delete(id);
      return next;
    });
    onSavedChanged?.();
  };

  if (data && !data.configured) {
    return <EmptyState title="Stories are not set up" hint="The news hub (NEWS_HUB_URL, NEWS_HUB_API_KEY) is not configured on the server." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-xl border border-edge bg-surface-2 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p.key ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {edition?.periodKey ? <span className="text-xs text-fg-subtle">{edition.periodKey}</span> : null}
        {loading ? <Spinner /> : null}
      </div>

      {(data?.topics || []).length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-subtle mr-1">Topics{followed.size ? "" : " (all)"}:</span>
          {data.topics.map((t) => (
            <Chip key={t.key} onClick={() => toggleTopic(t.key)} tone={followed.has(t.key) ? "primary" : "neutral"}>
              {t.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <LanguageTabs
        tabs={editions.map((e) => ({
          key: e.key,
          label: editionLabel(e),
          count: e.digests.reduce((n, d) => n + d.stories.length, 0),
        }))}
        active={edition?.key || ""}
        onChange={setActive}
        label="Editions"
      />

      {data?.error ? <Banner tone="warning">{data.error}</Banner> : null}

      {!loading && edition && !edition.digests.length ? (
        <EmptyState
          title={`No ${period === "daily" ? "stories today" : "weekly catch-up"} yet`}
          hint={period === "daily" ? "Stories are written every morning." : "The catch-up of last week is written on Mondays."}
        />
      ) : null}

      {edition?.digests.map((d) => (
        <section key={d.topic} className="space-y-2.5">
          <h2 className="text-sm font-semibold text-fg">{d.topicName}</h2>
          {d.trends ? (
            <Banner tone="info" Icon={IconTrend}>
              {d.trends}
            </Banner>
          ) : null}
          {d.stories.map((s) => (
            <HubStoryCard
              key={s.id}
              story={s}
              rank={s.rank}
              language={data.language}
              saved={saved.has(s.id)}
              onSaved={onSaved}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
