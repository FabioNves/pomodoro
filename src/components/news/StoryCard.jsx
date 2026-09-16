"use client";

// One briefing story: headline, summary, why it matters, sources, and the
// feedback / save / follow / ask actions.

import React, { useState } from "react";
import { openExternal } from "@/lib/platform";
import AskStoryPanel from "@/components/news/AskStoryPanel";
import { languageName } from "@/lib/news/locales";
import {
  Chip,
  IconBookmark,
  IconThumbUp,
  IconThumbDown,
  IconStar,
  IconEyeOff,
  IconExternal,
  IconChat,
  IconPlus,
  formatDate,
} from "@/components/news/newsUi";

const FEEDBACK = [
  { value: "relevant", label: "Relevant", Icon: IconThumbUp, active: "bg-success-soft text-success border-success/40" },
  { value: "interesting", label: "Interesting", Icon: IconStar, active: "bg-accent-soft text-accent border-accent/40" },
  { value: "not_relevant", label: "Not relevant", Icon: IconThumbDown, active: "bg-warning-soft text-warning border-warning/40" },
  { value: "not_interested", label: "Not interested", Icon: IconEyeOff, active: "bg-danger-soft text-danger border-danger/40" },
];

function IconButton({ label, Icon, active, activeClass, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-50 ${
        active ? activeClass : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function StoryCard({
  story,
  rank,
  onFeedback,
  onSave,
  onFollow,
  followedTopics = new Set(),
  busy = false,
}) {
  const [askOpen, setAskOpen] = useState(false);
  const extraSources = (story.sources || []).filter((s) => s.url !== story.url);
  // Topics the story matched (already followed) and new ones worth following.
  const matched = story.topics || [];
  const followable = (story.suggestedTopics || []).filter(
    (t) => !followedTopics.has(t.toLowerCase()) && !matched.some((m) => m.toLowerCase() === t.toLowerCase()),
  );

  return (
    <article className="bg-surface border border-edge rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {typeof rank === "number" ? (
          <span className="shrink-0 w-7 h-7 rounded-lg bg-primary-soft text-primary text-xs font-bold flex items-center justify-center tabular-nums">
            {rank}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-subtle">
            <span className="font-semibold text-fg-muted">{story.publisher || "Source"}</span>
            {story.publishedAt ? <span>· {formatDate(story.publishedAt)}</span> : <span>· date not provided</span>}
            {story.section === "worthKnowing" ? <span className="text-accent">· Worth knowing</span> : null}
            {story.section === "missed" ? <span className="text-accent">· You may have missed</span> : null}
            {story.language && story.outputLanguage && story.language !== story.outputLanguage ? (
              <span title="Summarised from sources in another language">· translated from {languageName(story.language)}</span>
            ) : null}
          </p>
          <h3 className="mt-1 text-base sm:text-lg font-semibold text-fg leading-snug">
            <a
              href={story.url}
              onClick={(e) => {
                e.preventDefault();
                openExternal(story.url);
              }}
              className="hover:text-primary transition-colors"
            >
              {story.headline}
            </a>
          </h3>
        </div>
      </div>

      <p className="mt-2.5 text-sm text-fg leading-relaxed">{story.summary}</p>

      {story.whyItMatters ? (
        <div className="mt-2.5 rounded-lg bg-surface-2 border border-edge px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-fg-subtle">
            Why it matters{story.isAnalysis ? " · analysis" : ""}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted leading-relaxed">{story.whyItMatters}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => openExternal(story.url)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-primary/40 bg-primary-soft text-primary text-xs font-medium hover:bg-primary hover:text-primary-fg transition-colors"
          title={story.url}
        >
          <IconExternal className="w-3 h-3" />
          Open source
        </button>
        {extraSources.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => openExternal(s.url)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-edge text-xs text-fg-muted hover:text-fg hover:border-edge-strong transition-colors max-w-[220px]"
            title={s.title || s.url}
          >
            <span className="truncate">{s.publisher || s.title || s.url}</span>
          </button>
        ))}
      </div>

      {matched.length || followable.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {matched.map((t) => (
            <Chip key={`m-${t}`} tone="primary" title="One of your topics">
              {t}
            </Chip>
          ))}
          {followable.map((t) => (
            <Chip key={`f-${t}`} onClick={() => onFollow?.(t)} Icon={IconPlus} title={`Follow “${t}”`} disabled={busy}>
              Follow “{t}”
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-3 pt-3 border-t border-edge flex flex-wrap items-center gap-1.5">
        <IconButton
          label={story.saved ? "Saved" : "Save"}
          Icon={IconBookmark}
          active={story.saved}
          activeClass="bg-primary-soft text-primary border-primary/40"
          onClick={() => onSave?.(story)}
          disabled={busy}
        />
        {FEEDBACK.map((f) => (
          <IconButton
            key={f.value}
            label={f.label}
            Icon={f.Icon}
            active={story.feedback === f.value}
            activeClass={f.active}
            onClick={() => onFeedback?.(story, story.feedback === f.value ? null : f.value)}
            disabled={busy}
          />
        ))}
        <span className="flex-1" />
        <IconButton
          label={askOpen ? "Hide" : "Ask"}
          Icon={IconChat}
          active={askOpen}
          activeClass="bg-primary-soft text-primary border-primary/40"
          onClick={() => setAskOpen((v) => !v)}
        />
      </div>

      {askOpen ? <AskStoryPanel story={story} onClose={() => setAskOpen(false)} /> : null}
    </article>
  );
}
