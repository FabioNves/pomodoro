"use client";

// Followed topics: add any free-text topic, remove one, or pick from the
// suggestions. Topics followed from a story are marked.

import React, { useState } from "react";
import { ActionButton, Chip, IconPlus, IconTag, SectionTitle } from "@/components/news/newsUi";

export default function TopicsManager({ topics, suggested = [], onAdd, onRemove, busy = false }) {
  const [value, setValue] = useState("");
  const followed = new Set(topics.map((t) => t.name.toLowerCase()));
  const suggestions = suggested.filter((s) => !followed.has(s.toLowerCase()));

  const submit = async (e) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    const ok = await onAdd(name);
    if (ok !== false) setValue("");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <SectionTitle Icon={IconTag} count={topics.length}>
          Followed topics
        </SectionTitle>
        <p className="text-xs text-fg-muted -mt-1">
          Anything goes: technologies, companies, people, industries. Relevance is judged semantically, so “AI agents” also
          surfaces agent frameworks, tool use and autonomous coding systems.
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={80}
            placeholder="Add a topic, e.g. Anthropic, Next.js, semiconductors…"
            className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
          />
          <ActionButton type="submit" tone="primary" Icon={IconPlus} disabled={!value.trim()} busy={busy}>
            Follow
          </ActionButton>
        </form>
        {topics.length ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Chip
                key={t.id}
                tone="primary"
                onRemove={() => onRemove(t)}
                removeLabel={`Unfollow ${t.name}`}
                title={t.source === "story" ? "Followed from a story" : "Added in settings"}
              >
                {t.name}
                {t.source === "story" ? <span className="ml-1 text-[10px] opacity-70">· from story</span> : null}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">You are not following any topics yet.</p>
        )}
      </div>

      {suggestions.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s} onClick={() => onAdd(s)} Icon={IconPlus} disabled={busy}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
