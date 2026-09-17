"use client";

// Briefing settings: schedule (daily / weekly / monthly / custom days,
// timezone), editions (the locations and languages, and which briefings each
// one runs in), content (story count, length, major-only, worth knowing,
// interests) and the connection status of the MCP server and OpenAI.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { browserTimeZone } from "@/lib/news/client";
import { useAccess } from "@/lib/access/client";
import ConnectionStatus from "@/components/admin/ConnectionStatus";
import {
  COUNTRIES,
  LANGUAGES,
  MAX_EDITIONS,
  countryByCode,
  countryName,
  editionKinds,
  editionsForKind,
  editionsForLanguages,
  languageName,
  newEditionKey,
  normalizeEditionList,
} from "@/lib/news/locales";
import {
  ActionButton,
  Banner,
  Chip,
  DAY_LABELS,
  IconCheck,
  IconClock,
  IconGlobe,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconX,
  SectionTitle,
  SettingRow,
  Spinner,
  Toggle,
  formatDate,
} from "@/components/news/newsUi";

const LENGTHS = [
  { id: "short", name: "Short", hint: "One or two sentences per story" },
  { id: "medium", name: "Medium", hint: "Two or three sentences" },
  { id: "long", name: "Long", hint: "Fuller detail and context" },
];

const KIND_OPTIONS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const SELECT_CLASS =
  "w-full px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none disabled:opacity-50";

function timeZones() {
  try {
    const list = Intl.supportedValuesOf("timeZone");
    if (Array.isArray(list) && list.length) return list;
  } catch {
    /* older engines */
  }
  return ["UTC", "Europe/Lisbon", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
}

function TimeInput({ value, onChange, disabled, label }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      disabled={disabled}
      className="px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg tabular-nums focus:border-focus outline-none disabled:opacity-50"
    />
  );
}

/** 1 -> "1st", 22 -> "22nd". Used for the day-of-month picker. */
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
}

function Block({ children }) {
  return <div className="bg-surface-2 p-4 rounded-lg space-y-4 transition-colors duration-300">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

/** Which briefings an edition runs in. */
function KindChips({ kinds, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {KIND_OPTIONS.map((k) => (
        <Chip key={k.key} tone={kinds.includes(k.key) ? "primary" : "neutral"} onClick={() => onToggle(k.key)}>
          {k.label}
        </Chip>
      ))}
    </div>
  );
}

/** One edition: where it looks, in which language, and when it runs. */
function EditionRow({ edition, index, total, userLanguage, onChange, onRemove, onMove }) {
  const chosen = edition.countries || [];
  const available = COUNTRIES.filter((c) => !chosen.includes(c.code));
  const kinds = editionKinds(edition);

  const addCountry = (code) => {
    if (!code || chosen.includes(code)) return;
    const patch = { countries: [...chosen, code] };
    // Picking a country without a language implies the country's own press.
    if (!edition.language) patch.language = countryByCode(code)?.languages?.[0] || "";
    onChange(patch);
  };

  const toggleKind = (kind) =>
    onChange({ kinds: kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind] });

  return (
    <div className="bg-surface border border-edge rounded-xl p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-fg">
          {chosen.length ? chosen.map(countryName).join(", ") : "Worldwide"}
          <span className="ml-2 text-[11px] font-normal text-fg-subtle">
            {edition.coverage === "top" ? "top news" : "your topics"}
            {edition.language ? ` · in ${languageName(edition.language)}` : ""}
          </span>
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="px-1.5 py-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30"
            aria-label="Move edition up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="px-1.5 py-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30"
            aria-label="Move edition down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-surface-hover transition-colors"
            aria-label="Remove edition"
            title="Remove edition"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Field label="Runs in">
        <KindChips kinds={kinds} onToggle={toggleKind} />
        {!kinds.length ? (
          <p className="text-[11px] text-warning">Not in any briefing yet, so nothing will build this edition.</p>
        ) : null}
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Locations">
          <div className="flex flex-wrap items-center gap-1.5">
            {chosen.length ? (
              chosen.map((code) => (
                <Chip
                  key={code}
                  onRemove={() => onChange({ countries: chosen.filter((c) => c !== code) })}
                  removeLabel={`Remove ${countryName(code)}`}
                >
                  {countryName(code)}
                </Chip>
              ))
            ) : (
              <Chip title="News from anywhere">Worldwide</Chip>
            )}
          </div>
          <select
            value=""
            aria-label="Add a country to this edition"
            onChange={(e) => addCountry(e.target.value)}
            disabled={chosen.length >= 8}
            className={SELECT_CLASS}
          >
            <option value="">Add a country…</option>
            {available.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="News language">
          <select
            value={edition.language || ""}
            aria-label="Language of the news to look for"
            onChange={(e) => onChange({ language: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Any language</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} ({l.name})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Written in">
          <select
            value={edition.output || "source"}
            aria-label="Language this edition is written in"
            onChange={(e) => onChange({ output: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="source">
              {edition.language ? `Its own language (${languageName(edition.language)})` : `Your language (${languageName(userLanguage)})`}
            </option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                Translate to {l.native} ({l.name})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Covers">
          <select
            value={edition.coverage || "topics"}
            aria-label="What this edition covers"
            onChange={(e) => onChange({ coverage: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="topics">Your topics, in this region</option>
            <option value="top">The region’s most important news</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

export default function NewsSettings({ preferences, onSave, saving, status, statusLoading, onRefreshStatus, nextDelivery }) {
  const access = useAccess();
  // Only the admin's own view carries the connection report; a preview
  // shows the settings exactly as that role sees them.
  const showConnection = access.isAdmin && !access.previewing;
  const [form, setForm] = useState(preferences);
  const [dirty, setDirty] = useState(false);
  const [quickLanguages, setQuickLanguages] = useState([]);
  const [quickOutput, setQuickOutput] = useState("source");
  const [quickKinds, setQuickKinds] = useState(["weekly"]);
  const zones = useMemo(timeZones, []);

  useEffect(() => {
    setForm(preferences);
    setDirty(false);
  }, [preferences]);

  if (!form) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading settings…
      </p>
    );
  }

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const updateNested = (key, patch) => update({ [key]: { ...form[key], ...patch } });
  const toggleCustomDay = (d) => {
    const days = form.custom.days.includes(d) ? form.custom.days.filter((x) => x !== d) : [...form.custom.days, d].sort();
    updateNested("custom", { days });
  };

  const editions = normalizeEditionList(form.editions);
  const setEditions = (list) => update({ editions: list.slice(0, MAX_EDITIONS) });
  const patchEdition = (index, patch) => setEditions(editions.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const moveEdition = (index, delta) => {
    const next = [...editions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditions(next);
  };
  const blankEdition = (kinds) => ({
    key: newEditionKey(),
    countries: [],
    language: "",
    output: "source",
    coverage: "topics",
    kinds,
  });
  const addEdition = () => setEditions([...editions, blankEdition(["daily"])]);
  const addPerLanguage = () => {
    if (!quickLanguages.length) return;
    const added = editionsForLanguages(quickLanguages, { output: quickOutput, kinds: quickKinds });
    // The first editions added keep what a briefing does by default, so a
    // Portuguese edition never silently replaces the reader's own topics.
    setEditions(editions.length ? [...editions, ...added] : [blankEdition(quickKinds), ...added]);
    setQuickLanguages([]);
  };
  const toggleQuickKind = (kind) =>
    setQuickKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const save = async () => {
    const ok = await onSave({
      timezone: form.timezone,
      daily: form.daily,
      weekly: form.weekly,
      monthly: form.monthly,
      custom: form.custom,
      customInterests: form.customInterests,
      storyCount: form.storyCount,
      briefingLength: form.briefingLength,
      majorNewsOnly: form.majorNewsOnly,
      includeWorthKnowing: form.includeWorthKnowing,
      language: form.language,
      editions,
    });
    if (ok) setDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Schedule */}
      <div className="space-y-3">
        <SectionTitle Icon={IconClock}>Schedule</SectionTitle>
        <Block>
          <SettingRow title="Daily briefing" hint="Generated on the server every day at this time, whether or not the app is open.">
            <div className="flex items-center gap-2">
              <TimeInput label="Daily briefing time" value={form.daily.time} onChange={(time) => updateNested("daily", { time })} disabled={!form.daily.enabled} />
              <Toggle checked={form.daily.enabled} onChange={(enabled) => updateNested("daily", { enabled })} label="Daily briefing" />
            </div>
          </SettingRow>
          <SettingRow title="Weekly briefing" hint="A synthesis of the week: biggest developments, trends and what you may have missed.">
            <div className="flex items-center gap-2">
              <select
                value={form.weekly.day}
                aria-label="Weekly briefing day"
                onChange={(e) => updateNested("weekly", { day: Number(e.target.value) })}
                disabled={!form.weekly.enabled}
                className="px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none disabled:opacity-50"
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <TimeInput label="Weekly briefing time" value={form.weekly.time} onChange={(time) => updateNested("weekly", { time })} disabled={!form.weekly.enabled} />
              <Toggle checked={form.weekly.enabled} onChange={(enabled) => updateNested("weekly", { enabled })} label="Weekly briefing" />
            </div>
          </SettingRow>
          <SettingRow title="Monthly briefing" hint="A synthesis of the month: what mattered and what came of it, not everything that happened.">
            <div className="flex items-center gap-2">
              <select
                value={form.monthly.day}
                aria-label="Monthly briefing day"
                onChange={(e) => updateNested("monthly", { day: Number(e.target.value) })}
                disabled={!form.monthly.enabled}
                className="px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none disabled:opacity-50"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {ordinal(d)}
                  </option>
                ))}
              </select>
              <TimeInput
                label="Monthly briefing time"
                value={form.monthly.time}
                onChange={(time) => updateNested("monthly", { time })}
                disabled={!form.monthly.enabled}
              />
              <Toggle
                checked={form.monthly.enabled}
                onChange={(enabled) => updateNested("monthly", { enabled })}
                label="Monthly briefing"
              />
            </div>
          </SettingRow>
          <div className="space-y-2">
            <SettingRow title="Custom schedule" hint="A daily-style briefing only on the days you pick.">
              <div className="flex items-center gap-2">
                <TimeInput label="Custom briefing time" value={form.custom.time} onChange={(time) => updateNested("custom", { time })} disabled={!form.custom.enabled} />
                <Toggle checked={form.custom.enabled} onChange={(enabled) => updateNested("custom", { enabled })} label="Custom schedule" />
              </div>
            </SettingRow>
            <div className={`flex flex-wrap gap-1.5 ${form.custom.enabled ? "" : "opacity-50 pointer-events-none"}`}>
              {DAY_LABELS.map((d, i) => (
                <Chip key={d} onClick={() => toggleCustomDay(i)} tone={form.custom.days.includes(i) ? "primary" : "neutral"}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>
          <SettingRow title="Timezone" hint="Delivery times are interpreted in this zone.">
            <div className="flex items-center gap-2 min-w-0">
              <select
                value={form.timezone}
                aria-label="Timezone"
                onChange={(e) => update({ timezone: e.target.value })}
                className="max-w-[220px] px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none"
              >
                {!zones.includes(form.timezone) ? <option value={form.timezone}>{form.timezone}</option> : null}
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => update({ timezone: browserTimeZone() })}
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                Use device
              </button>
            </div>
          </SettingRow>
          {nextDelivery ? (
            <p className="text-xs text-fg-muted">
              Next scheduled briefing: <strong className="text-fg">{nextDelivery.kind}</strong> at {formatDate(nextDelivery.at, { withTime: true })}
              {status?.scheduler && !status.scheduler.configured ? (
                <span className="text-warning"> · CRON_SECRET is not set on the server, so the scheduler is not active.</span>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-fg-subtle">No schedule enabled. You can still generate briefings manually.</p>
          )}
        </Block>
      </div>

      {/* Editions */}
      <div className="space-y-3">
        <SectionTitle Icon={IconGlobe}>Editions</SectionTitle>
        <Block>
          <SettingRow title="Your language" hint="Where an edition set to “your language” is written, and the default for translations.">
            <select
              value={form.language || "en"}
              aria-label="Your language"
              onChange={(e) => update({ language: e.target.value })}
              className="px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg focus:border-focus outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.name})
                </option>
              ))}
            </select>
          </SettingRow>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">
                Your editions
                <span className="ml-2 text-[11px] font-normal text-fg-subtle tabular-nums">
                  {KIND_OPTIONS.map((k) => `${k.label} ${editionsForKind(editions, k.key).length}`).join(" · ")}
                </span>
              </p>
              <ActionButton size="sm" Icon={IconPlus} onClick={addEdition} disabled={editions.length >= MAX_EDITIONS}>
                Add edition
              </ActionButton>
            </div>

            <p className="text-xs text-fg-muted">
              Write an edition once and tick the briefings it belongs to: the same Portugal edition can run in your
              weekly and your monthly. A briefing no edition runs in builds a single worldwide edition about your
              topics, as it always did. Custom-schedule briefings run the daily editions.
            </p>

            {editions.length ? (
              <div className="space-y-2">
                {editions.map((edition, index) => (
                  <EditionRow
                    key={edition.key || index}
                    edition={edition}
                    index={index}
                    total={editions.length}
                    userLanguage={form.language || "en"}
                    onChange={(patch) => patchEdition(index, patch)}
                    onRemove={() => setEditions(editions.filter((_, i) => i !== index))}
                    onMove={(delta) => moveEdition(index, delta)}
                  />
                ))}
                <button type="button" onClick={() => setEditions([])} className="text-xs text-primary hover:underline">
                  Remove all editions
                </button>
              </div>
            ) : null}

            <div className="bg-surface border border-edge rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-fg">One edition per language you read</p>
              <p className="text-xs text-fg-muted">
                Adds a top-news edition for each language’s main country. Change the country or the briefings
                afterwards on each row.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <Chip
                    key={l.code}
                    tone={quickLanguages.includes(l.code) ? "primary" : "neutral"}
                    onClick={() =>
                      setQuickLanguages((prev) => (prev.includes(l.code) ? prev.filter((c) => c !== l.code) : [...prev, l.code]))
                    }
                  >
                    {l.native}
                  </Chip>
                ))}
              </div>
              <Field label="Run them in">
                <KindChips kinds={quickKinds} onToggle={toggleQuickKind} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={quickOutput}
                  aria-label="Language the new editions are written in"
                  onChange={(e) => setQuickOutput(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg focus:border-focus outline-none"
                >
                  <option value="source">Each in its own language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      All translated to {l.native}
                    </option>
                  ))}
                </select>
                <ActionButton
                  size="sm"
                  tone="primary"
                  Icon={IconPlus}
                  onClick={addPerLanguage}
                  disabled={!quickLanguages.length || !quickKinds.length}
                >
                  Add {quickLanguages.length || ""} edition{quickLanguages.length === 1 ? "" : "s"}
                </ActionButton>
              </div>
            </div>

            <p className="text-[11px] text-fg-subtle">
              Each edition is its own search pass and its own AI summary: roughly one to two minutes and a handful of
              searches each, and they arrive one at a time. Up to {MAX_EDITIONS} editions.
            </p>
          </div>
        </Block>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <SectionTitle Icon={IconSparkles}>Content</SectionTitle>
        <Block>
          <div>
            <div className="flex items-center justify-between text-sm text-fg mb-1">
              <span className="font-medium">Number of stories</span>
              <span className="tabular-nums text-fg-muted">{form.storyCount}</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={form.storyCount}
              onChange={(e) => update({ storyCount: Number(e.target.value) })}
              className="w-full accent-primary"
              aria-label="Number of stories"
            />
            <p className="text-[11px] text-fg-subtle">Per edition.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-fg mb-2">Briefing length</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Briefing length">
              {LENGTHS.map((o) => {
                const active = o.id === form.briefingLength;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ briefingLength: o.id })}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${active ? "border-primary bg-primary-soft" : "border-edge bg-surface hover:border-edge-strong"}`}
                  >
                    <p className="text-sm font-semibold text-fg">{o.name}</p>
                    <p className="text-[11px] text-fg-subtle">{o.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <SettingRow title="Major news only" hint="Skip minor updates and incremental releases.">
            <Toggle checked={form.majorNewsOnly} onChange={(majorNewsOnly) => update({ majorNewsOnly })} label="Major news only" />
          </SettingRow>
          <SettingRow title="Include “Worth knowing”" hint="Up to three important developments outside your topics.">
            <Toggle checked={form.includeWorthKnowing} onChange={(includeWorthKnowing) => update({ includeWorthKnowing })} label="Worth knowing" />
          </SettingRow>
          <div>
            <p className="text-sm font-medium text-fg">Your interests, in your own words</p>
            <p className="text-xs text-fg-muted mb-2">Optional. Helps the ranking judge relevance, e.g. “Solo dev shipping a Next.js SaaS; I care about developer tooling and pricing changes more than funding rounds.”</p>
            <textarea
              value={form.customInterests}
              aria-label="Your interests, in your own words"
              onChange={(e) => update({ customInterests: e.target.value.slice(0, 1000) })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
              placeholder="What do you want to hear about, and what bores you?"
            />
            <p className="text-[11px] text-fg-subtle text-right tabular-nums">{form.customInterests.length}/1000</p>
          </div>
        </Block>
      </div>

      <div className="flex items-center gap-3">
        <ActionButton tone="primary" size="lg" Icon={IconCheck} onClick={save} busy={saving} disabled={!dirty}>
          Save settings
        </ActionButton>
        {dirty ? <span className="text-xs text-fg-subtle">Unsaved changes</span> : null}
      </div>

      {/* Connection: admin only. The canonical report is /admin?tab=connections. */}
      {showConnection ? (
        <div className="space-y-3">
          <SectionTitle Icon={IconGlobe}>Connection</SectionTitle>
          <Block>
            <ConnectionStatus status={status} loading={statusLoading} onRefresh={onRefreshStatus} />
          </Block>
          <p className="text-[11px] text-fg-subtle flex items-center gap-1.5">
            <IconSettings className="w-3 h-3" />
            API keys never leave the server. The full report, with the database and sign-in configuration, is on the{" "}
            <Link href="/admin?tab=connections" className="text-primary hover:underline">
              admin page
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
