"use client";

// Followed topics: add any free-text topic, pick from the suggestions by
// category, and choose which editions each topic is followed in — "AI" in
// every edition, "Portuguese politics" only in the Portugal one.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SUGGESTED_TOPIC_GROUPS } from "@/lib/news/topicSuggestions";
import { countryName, editionKinds, languageName } from "@/lib/news/locales";
import {
  ActionButton,
  Chip,
  IconChevronDown,
  IconCheck,
  IconPlus,
  IconTag,
  IconX,
  SectionTitle,
} from "@/components/news/newsUi";

function editionLabel(edition) {
  const places = (edition.countries || []).map(countryName).filter(Boolean);
  if (places.length) return places.join(", ");
  return edition.language ? `Worldwide (${languageName(edition.language)})` : "Worldwide";
}

function editionHint(edition) {
  const bits = [edition.coverage === "top" ? "top news" : "your topics"];
  const kinds = editionKinds(edition);
  if (kinds.length) bits.push(kinds.join(", "));
  return bits.join(" · ");
}

/** Picks the editions something applies to; nothing selected means all. */
function ScopeMenu({ editions, value, onChange, buttonLabel, disabled = false }) {
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

  // An edition removed in settings should not keep a topic pinned to nothing.
  const selected = (value || []).filter((k) => editions.some((e) => e.key === k));
  const summary =
    buttonLabel ||
    (selected.length === 0
      ? "All editions"
      : selected.length === 1
        ? editionLabel(editions.find((e) => e.key === selected[0]))
        : `${selected.length} editions`);

  const toggle = (key) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-edge text-[11px] font-medium text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors disabled:opacity-50 max-w-[180px]"
      >
        <span className="truncate">{summary}</span>
        <IconChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-60 max-h-72 overflow-y-auto rounded-xl border border-edge bg-surface shadow-lg p-1"
        >
          <button
            role="menuitemcheckbox"
            aria-checked={selected.length === 0}
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left"
          >
            <IconCheck className={`w-3.5 h-3.5 shrink-0 ${selected.length === 0 ? "text-primary" : "opacity-0"}`} />
            <span className="text-sm text-fg">All editions</span>
          </button>
          <div className="my-1 border-t border-edge" />
          {editions.map((edition) => {
            const on = selected.includes(edition.key);
            return (
              <button
                key={edition.key}
                role="menuitemcheckbox"
                aria-checked={on}
                type="button"
                onClick={() => toggle(edition.key)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left"
              >
                <IconCheck className={`w-3.5 h-3.5 shrink-0 ${on ? "text-primary" : "opacity-0"}`} />
                <span className="min-w-0">
                  <span className="block text-sm text-fg truncate">{editionLabel(edition)}</span>
                  <span className="block text-[11px] text-fg-subtle truncate">{editionHint(edition)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function TopicsManager({
  topics,
  suggested = [],
  editions = [],
  onAdd,
  onRemove,
  onSetEditions,
  busy = false,
}) {
  const [value, setValue] = useState("");
  const [scope, setScope] = useState([]);
  const [group, setGroup] = useState(SUGGESTED_TOPIC_GROUPS[0].name);

  const followed = useMemo(() => new Set(topics.map((t) => t.name.toLowerCase())), [topics]);
  // The server sends the list it knows; the groups give it a shape. Anything
  // the server suggests that is not grouped goes under "More".
  const groups = useMemo(() => {
    const known = new Set(SUGGESTED_TOPIC_GROUPS.flatMap((g) => g.topics.map((t) => t.toLowerCase())));
    const extra = suggested.filter((s) => !known.has(s.toLowerCase()));
    const all = extra.length ? [...SUGGESTED_TOPIC_GROUPS, { name: "More", topics: extra }] : SUGGESTED_TOPIC_GROUPS;
    return all
      .map((g) => ({ ...g, topics: g.topics.filter((t) => !followed.has(t.toLowerCase())) }))
      .filter((g) => g.topics.length);
  }, [suggested, followed]);

  const activeGroup = groups.find((g) => g.name === group) || groups[0];
  const scoped = editions.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    const ok = await onAdd(name, scope);
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
          {scoped ? " Each topic can apply to every edition or only to some of them." : ""}
        </p>

        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={80}
            placeholder="Add a topic, e.g. Anthropic, Next.js, semiconductors…"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
          />
          {scoped ? (
            <ScopeMenu
              editions={editions}
              value={scope}
              onChange={setScope}
              buttonLabel={scope.length ? `Adding to ${scope.length}` : "Adding to all"}
            />
          ) : null}
          <ActionButton type="submit" tone="primary" Icon={IconPlus} disabled={!value.trim()} busy={busy}>
            Follow
          </ActionButton>
        </form>

        {topics.length ? (
          <ul className="divide-y divide-edge border border-edge rounded-xl bg-surface">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg truncate">{t.name}</span>
                  {t.source === "story" ? (
                    <span className="block text-[11px] text-fg-subtle">followed from a story</span>
                  ) : null}
                </span>
                {scoped ? (
                  <ScopeMenu
                    editions={editions}
                    value={t.editions}
                    onChange={(keys) => onSetEditions?.(t, keys)}
                    disabled={busy}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(t)}
                  className="shrink-0 p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-surface-hover transition-colors"
                  aria-label={`Unfollow ${t.name}`}
                  title="Unfollow"
                >
                  <IconX className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-subtle">You are not following any topics yet.</p>
        )}
      </div>

      {groups.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <Chip key={g.name} tone={activeGroup?.name === g.name ? "primary" : "neutral"} onClick={() => setGroup(g.name)}>
                {g.name}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {(activeGroup?.topics || []).map((s) => (
              <Chip key={s} onClick={() => onAdd(s, scope)} Icon={IconPlus} disabled={busy}>
                {s}
              </Chip>
            ))}
          </div>
          {scoped ? (
            <p className="text-[11px] text-fg-subtle">
              Added to {scope.length ? `${scope.length} edition${scope.length === 1 ? "" : "s"}` : "every edition"}, as
              chosen next to the box above.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
