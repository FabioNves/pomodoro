"use client";

// Renders one briefing in any state: generating (progress), failed (error),
// empty (honest "nothing reliable found"), or ready (the briefing itself).

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { openExternal } from "@/lib/platform";
import StoryCard from "@/components/news/StoryCard";
import {
  ActionButton,
  Banner,
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

  const { top = [], worthKnowing = [], missed = [] } = briefing.sections || {};
  let rank = 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-wide text-fg-subtle">
          {KIND_TEXT[briefing.kind]?.eyebrow || "Daily briefing"} · {periodText(briefing)}
          {briefing.completedAt ? ` · generated ${relativeTime(briefing.completedAt)}` : ""}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          {briefing.title || KIND_TEXT[briefing.kind]?.title || "Your briefing"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted leading-relaxed">
          {briefing.intro || KIND_TEXT[briefing.kind]?.intro || "Here are the most relevant developments for you today."}
        </p>
        {briefing.note ? (
          <div className="mt-3">
            <Banner tone="warning">{briefing.note}</Banner>
          </div>
        ) : null}
      </header>

      {briefing.highlights?.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconSparkles} count={briefing.highlights.length}>
            Biggest developments
          </SectionTitle>
          <GroupedList items={briefing.highlights} />
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
              return (
                <StoryCard
                  key={story.id}
                  story={story}
                  rank={rank}
                  onFeedback={onFeedback}
                  onSave={onSave}
                  onFollow={onFollow}
                  followedTopics={followedTopics}
                  busy={busy}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">No stories matched your topics closely enough today.</p>
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
              <StoryCard key={story.id} story={story} onFeedback={onFeedback} onSave={onSave} onFollow={onFollow} followedTopics={followedTopics} busy={busy} />
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
              <StoryCard key={story.id} story={story} onFeedback={onFeedback} onSave={onSave} onFollow={onFollow} followedTopics={followedTopics} busy={busy} />
            ))}
          </div>
        </section>
      ) : null}

      {briefing.trends?.length ? (
        <section className="space-y-3">
          <SectionTitle Icon={IconTrend} count={briefing.trends.length}>
            Emerging trends
          </SectionTitle>
          <p className="text-xs text-fg-subtle -mt-1">Only where several retrieved stories point the same way.</p>
          <GroupedList items={briefing.trends} />
        </section>
      ) : null}

      <footer className="pt-4 border-t border-edge">
        <Stats stats={briefing.stats} />
      </footer>
    </motion.div>
  );
}
