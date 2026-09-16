"use client";

// Renders one briefing in any state: generating (progress), failed (error),
// empty (honest "nothing reliable found"), or ready (the briefing itself).
//
// A run may hold several editions, one per location or group of locations.
// Those are shown as a tab per language, each tab holding its editions as
// sections the reader can open and close. Editions arrive one at a time, so
// a tab can be readable while the rest of the run is still being built.

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { openExternal } from "@/lib/platform";
import StoryCard from "@/components/news/StoryCard";
import LanguageTabs, { languageTabLabel } from "@/components/news/LanguageTabs";
import { countryName, languageName } from "@/lib/news/locales";
import {
  ActionButton,
  Banner,
  Chip,
  EmptyState,
  SectionTitle,
  Spinner,
  IconAlert,
  IconNews,
  IconSparkles,
  IconTrend,
  IconGlobe,
  IconRefresh,
  IconExternal,
  IconChevronDown,
  IconChevronUp,
  formatDate,
  relativeTime,
} from "@/components/news/newsUi";

const KIND_TEXT = {
  daily: {
    eyebrow: "Daily briefing",
    title: "Your briefing",
    intro: "Here are the most relevant developments for you today.",
  },
  weekly: {
    eyebrow: "Weekly briefing",
    title: "Your week in review",
    intro: "Here are the developments that shaped your week.",
  },
  monthly: {
    eyebrow: "Monthly briefing",
    title: "Your month in review",
    intro: "Here are the developments that mattered most over the past month.",
  },
  custom: {
    eyebrow: "Scheduled briefing",
    title: "Your briefing",
    intro: "Here are the most relevant developments for you.",
  },
};

const PROGRESS_STEPS = [
  "Planning searches for your topics…",
  "Searching the web through the MCP server…",
  "Reading the most relevant articles…",
  "Ranking and summarising with OpenAI…",
  "Checking every story against its sources…",
];

function periodText(briefing) {
  if (!briefing?.periodKey) return "";
  const d = new Date(`${briefing.periodKey}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return briefing.periodKey;
  const day = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const span = { weekly: 6, monthly: 30 }[briefing.kind];
  if (!span) return day;
  const start = new Date(d.getTime() - span * 86400000);
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })} – ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

function SourceLinks({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <button
          key={s.url}
          type="button"
          onClick={() => openExternal(s.url)}
          className="inline-flex items-center gap-1 max-w-[260px] px-2.5 py-1 rounded-full border border-edge text-[11px] text-fg-muted hover:text-primary hover:border-primary/40 transition-colors"
          title={s.title || s.url}
        >
          <IconExternal className="w-3 h-3 shrink-0" />
          <span className="truncate">{s.publisher || s.title || s.url}</span>
          {s.publishedAt ? <span className="shrink-0 text-fg-subtle">· {formatDate(s.publishedAt)}</span> : null}
        </button>
      ))}
    </div>
  );
}

function GroupedList({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="bg-surface border border-edge rounded-2xl shadow-sm p-4">
          <p className="text-sm font-semibold text-fg">{item.title}</p>
          <p className="mt-1 text-sm text-fg-muted leading-relaxed">{item.summary}</p>
          <SourceLinks sources={item.sources} />
        </li>
      ))}
    </ol>
  );
}

function Generating({ briefing }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(PROGRESS_STEPS.length - 1, s + 1)), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-surface border border-edge rounded-2xl shadow-sm p-6 flex flex-col items-center text-center gap-3">
      <span className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
        <Spinner className="w-6 h-6" />
      </span>
      <p className="text-sm font-semibold text-fg">Building your {briefing.kind} briefing</p>
      <p className="text-xs text-fg-muted">{PROGRESS_STEPS[step]}</p>
      <p className="text-[11px] text-fg-subtle">
        Started {relativeTime(briefing.createdAt)}. This usually takes one to three minutes; you can leave this page.
      </p>
    </div>
  );
}

function Stats({ stats }) {
  if (!stats) return null;
  const bits = [];
  if (stats.uniqueArticles) bits.push(`${stats.uniqueArticles} sources found across ${stats.searchesOk} searches`);
  if (stats.pagesFetched) bits.push(`${stats.pagesFetched} articles read in full`);
  if (stats.mcpServer) bits.push(`MCP tools: ${stats.mcpServer}`);
  if (stats.model) bits.push(`model: ${stats.model}`);
  if (stats.durationMs) bits.push(`${Math.round(stats.durationMs / 1000)} s`);
  return (
    <div className="text-[11px] text-fg-subtle space-y-1">
      {bits.length ? <p>{bits.join(" · ")}</p> : null}
      {stats.warnings?.length ? (
        <ul className="space-y-0.5">
          {stats.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-warning">
              <IconAlert className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The stories and grouped items of one briefing or one edition. */
function BriefingBody({ content, actions, emptyText = "No stories matched your topics closely enough today." }) {
  const { top = [], worthKnowing = [], missed = [] } = content.sections || {};
  let rank = 0;
  return (
    <div className="space-y-6">
      {content.highlights?.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconSparkles} count={content.highlights.length}>
            Biggest developments
          </SectionTitle>
          <GroupedList items={content.highlights} />
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle Icon={IconNews} count={top.length}>
          Top stories
        </SectionTitle>
        {top.length ? (
          <div className="space-y-3">
            {top.map((story) => {
              rank += 1;
              return <StoryCard key={story.id} story={story} rank={rank} {...actions} />;
            })}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">{emptyText}</p>
        )}
      </section>

      {worthKnowing.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconGlobe} count={worthKnowing.length}>
            Worth knowing
          </SectionTitle>
          <p className="text-xs text-fg-subtle -mt-1">Important developments outside your topics.</p>
          <div className="space-y-3">
            {worthKnowing.map((story) => (
              <StoryCard key={story.id} story={story} {...actions} />
            ))}
          </div>
        </section>
      ) : null}

      {missed.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconAlert} count={missed.length}>
            You may have missed
          </SectionTitle>
          <div className="space-y-3">
            {missed.map((story) => (
              <StoryCard key={story.id} story={story} {...actions} />
            ))}
          </div>
        </section>
      ) : null}

      {content.trends?.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconTrend} count={content.trends.length}>
            Emerging trends
          </SectionTitle>
          <p className="text-xs text-fg-subtle -mt-1">Only where several retrieved stories point the same way.</p>
          <GroupedList items={content.trends} />
        </section>
      ) : null}
    </div>
  );
}

/* ── editions ──────────────────────────────────────────── */

function editionTitle(edition) {
  const places = (edition.countries || []).map(countryName).filter(Boolean);
  if (!places.length) return "Worldwide";
  if (places.length <= 2) return places.join(" and ");
  return `${places.slice(0, 2).join(", ")} +${places.length - 2}`;
}

function editionSubtitle(edition) {
  const bits = [edition.coverage === "top" ? "Top news of the region" : "Your topics"];
  if (edition.language) bits.push(`news in ${languageName(edition.language)}`);
  if (edition.outputLanguage && edition.outputLanguage !== edition.language) {
    bits.push(`written in ${languageName(edition.outputLanguage)}`);
  }
  return bits.join(" · ");
}

const EDITION_STATUS = {
  pending: { label: "Waiting", tone: "neutral" },
  generating: { label: "Building", tone: "primary" },
  ready: { label: "Ready", tone: "success" },
  empty: { label: "Nothing found", tone: "neutral" },
  failed: { label: "Failed", tone: "accent" },
};

function EditionSection({ edition, open, onToggle, actions }) {
  const status = EDITION_STATUS[edition.status] || EDITION_STATUS.pending;
  const Chevron = open ? IconChevronUp : IconChevronDown;
  return (
    <section className="border border-edge rounded-2xl bg-surface shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{editionTitle(edition)}</p>
          <p className="text-[11px] text-fg-subtle truncate">{editionSubtitle(edition)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {edition.status === "generating" ? <Spinner className="w-3.5 h-3.5 text-primary" /> : null}
          <Chip tone={status.tone}>
            {edition.status === "ready" ? `${edition.storyCount} stor${edition.storyCount === 1 ? "y" : "ies"}` : status.label}
          </Chip>
          <Chevron className="w-4 h-4 text-fg-subtle" />
        </div>
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-4 border-t border-edge pt-4">
          {edition.status === "pending" ? (
            <p className="text-sm text-fg-muted">Waiting its turn. Editions are built one after another.</p>
          ) : null}
          {edition.status === "generating" ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner /> Searching and summarising this edition…
            </p>
          ) : null}
          {edition.status === "failed" ? (
            <Banner tone="danger">{edition.error || "This edition could not be generated."}</Banner>
          ) : null}
          {edition.status === "empty" ? (
            <EmptyState
              Icon={IconGlobe}
              title="Nothing reliable to report"
              hint={edition.note || "No recent, relevant sources were retrieved for this edition."}
            />
          ) : null}
          {edition.status === "ready" ? (
            <>
              {edition.intro ? <p className="text-sm text-fg-muted leading-relaxed">{edition.intro}</p> : null}
              {edition.note ? <Banner tone="warning">{edition.note}</Banner> : null}
              <BriefingBody
                content={edition}
                actions={actions}
                emptyText="This edition produced no individual stories."
              />
            </>
          ) : null}
          <Stats stats={edition.stats} />
        </div>
      ) : null}
    </section>
  );
}

/** Editions grouped by the language their news was found in, in run order. */
function groupByLanguage(editions) {
  const groups = [];
  const index = new Map();
  for (const edition of editions) {
    const key = edition.language || "";
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, editions: [] });
    }
    groups[index.get(key)].editions.push(edition);
  }
  return groups;
}

function EditionsBriefing({ briefing, actions, onGenerate, generating }) {
  const editions = briefing.editions || [];
  const groups = useMemo(() => groupByLanguage(editions), [editions]);
  const firstReady = groups.find((g) => g.editions.some((e) => e.status === "ready"));
  const fallbackTab = (firstReady || groups[0])?.key ?? "";
  const [tab, setTab] = useState(null);
  const [openKeys, setOpenKeys] = useState({});

  const active = groups.some((g) => g.key === tab) ? tab : fallbackTab;
  const group = groups.find((g) => g.key === active);
  const done = briefing.editionsDone || 0;
  const total = briefing.editionsTotal || editions.length;
  const text = KIND_TEXT[briefing.kind] || KIND_TEXT.daily;

  const isOpen = (edition) => {
    if (edition.key in openKeys) return openKeys[edition.key];
    // Whatever the reader can actually read starts open; the first edition of
    // a tab opens even when it is still being built, so its progress shows.
    const readable = group?.editions.find((e) => e.status === "ready");
    return readable ? readable.key === edition.key : group?.editions[0]?.key === edition.key;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-wide text-fg-subtle">
          {text.eyebrow} · {periodText(briefing)}
          {briefing.completedAt ? ` · generated ${relativeTime(briefing.completedAt)}` : ""}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          {briefing.title || text.title}
        </h1>
        <p className="mt-2 text-sm text-fg-muted leading-relaxed">
          {briefing.intro || `${total} editions, one per region you follow.`}
        </p>
      </header>

      {briefing.status === "generating" ? (
        <div className="bg-surface border border-edge rounded-2xl shadow-sm p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Spinner /> Building edition {Math.min(done + 1, total)} of {total}
          </p>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="text-[11px] text-fg-subtle">
            Each edition is its own search and summary, so they arrive one at a time. You can read the ones that are
            ready, or leave this page.
          </p>
        </div>
      ) : null}

      {briefing.status === "failed" ? (
        <Banner tone="danger" action={<ActionButton size="sm" Icon={IconRefresh} onClick={onGenerate} busy={generating}>Try again</ActionButton>}>
          <p className="font-semibold">No edition could be generated.</p>
          <p className="mt-0.5">{briefing.error || "Unknown error."}</p>
        </Banner>
      ) : null}
      {briefing.status === "empty" ? <Banner tone="warning">{briefing.note || "No edition found anything reliable to report."}</Banner> : null}
      {briefing.status === "ready" && editions.some((e) => e.status === "failed") ? (
        <Banner tone="warning">
          {editions.filter((e) => e.status === "failed").length} of {total} editions failed. The rest are below.
        </Banner>
      ) : null}

      <LanguageTabs
        tabs={groups.map((g) => ({
          key: g.key,
          label: languageTabLabel(g.key),
          count: g.editions.reduce((n, e) => n + (e.storyCount || 0), 0),
          busy: g.editions.some((e) => e.status === "generating"),
          title: g.editions.map(editionTitle).join(", "),
        }))}
        active={active}
        onChange={setTab}
        label="Briefing languages"
      />

      <div className="space-y-3">
        {(group?.editions || []).map((edition) => (
          <EditionSection
            key={edition.key}
            edition={edition}
            open={isOpen(edition)}
            onToggle={() => setOpenKeys((prev) => ({ ...prev, [edition.key]: !isOpen(edition) }))}
            actions={actions}
          />
        ))}
      </div>

      <footer className="pt-4 border-t border-edge">
        <Stats stats={briefing.stats} />
      </footer>
    </motion.div>
  );
}

export default function BriefingView({
  briefing,
  onGenerate,
  onFeedback,
  onSave,
  onFollow,
  followedTopics,
  busy,
  generating,
}) {
  if (!briefing) {
    return (
      <EmptyState
        Icon={IconNews}
        title="No briefing yet"
        hint="Add a few topics, then generate your first briefing. Every story comes from a real web source retrieved through MCP; nothing is written from memory."
        action={
          <ActionButton tone="primary" Icon={IconSparkles} onClick={onGenerate} busy={generating}>
            Generate now
          </ActionButton>
        }
      />
    );
  }

  const actions = { onFeedback, onSave, onFollow, followedTopics, busy };
  const editionCount = Math.max(briefing.editions?.length || 0, briefing.editionsTotal || 0);
  if (editionCount > 1) {
    return <EditionsBriefing briefing={briefing} actions={actions} onGenerate={onGenerate} generating={generating} />;
  }

  if (briefing.status === "generating") return <Generating briefing={briefing} />;

  if (briefing.status === "failed") {
    return (
      <div className="space-y-3">
        <Banner tone="danger">
          <p className="font-semibold">This briefing could not be generated.</p>
          <p className="mt-0.5">{briefing.error || "Unknown error."}</p>
          {briefing.errorCode?.startsWith("mcp_") ? (
            <p className="mt-1 text-xs opacity-80">Check the MCP server settings under Settings → Connection.</p>
          ) : null}
          {briefing.errorCode?.startsWith("ai_") ? (
            <p className="mt-1 text-xs opacity-80">Check OPENAI_API_KEY on the server.</p>
          ) : null}
        </Banner>
        <Stats stats={briefing.stats} />
        <ActionButton tone="primary" Icon={IconRefresh} onClick={onGenerate} busy={generating}>
          Try again
        </ActionButton>
      </div>
    );
  }

  if (briefing.status === "empty") {
    return (
      <div className="space-y-3">
        <EmptyState
          Icon={IconGlobe}
          title="Nothing reliable to report"
          hint={briefing.note || "No recent, relevant sources were retrieved for your topics."}
          action={
            <ActionButton tone="primary" Icon={IconRefresh} onClick={onGenerate} busy={generating}>
              Generate again
            </ActionButton>
          }
        />
        <Stats stats={briefing.stats} />
      </div>
    );
  }

  const text = KIND_TEXT[briefing.kind] || KIND_TEXT.daily;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-wide text-fg-subtle">
          {text.eyebrow} · {periodText(briefing)}
          {briefing.completedAt ? ` · generated ${relativeTime(briefing.completedAt)}` : ""}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          {briefing.title || text.title}
        </h1>
        <p className="mt-2 text-sm text-fg-muted leading-relaxed">{briefing.intro || text.intro}</p>
        {briefing.note ? (
          <div className="mt-3">
            <Banner tone="warning">{briefing.note}</Banner>
          </div>
        ) : null}
      </header>

      <BriefingBody content={briefing} actions={actions} />

      <footer className="pt-4 border-t border-edge">
        <Stats stats={briefing.stats} />
      </footer>
    </motion.div>
  );
}
