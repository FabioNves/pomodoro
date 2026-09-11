"use client";

// Briefing settings: schedule (daily / weekly / custom days, timezone),
// content (story count, length, major-only, worth knowing, interests) and
// the connection status of the MCP server and OpenAI.

import React, { useEffect, useMemo, useState } from "react";
import { browserTimeZone } from "@/lib/news/client";
import {
  ActionButton,
  Banner,
  Chip,
  DAY_LABELS,
  IconCheck,
  IconClock,
  IconGlobe,
  IconRefresh,
  IconSettings,
  IconSparkles,
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

export default function NewsSettings({ preferences, onSave, saving, status, statusLoading, onRefreshStatus, nextDelivery }) {
  const [form, setForm] = useState(preferences);
  const [dirty, setDirty] = useState(false);
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
    });
    if (ok) setDirty(false);
  };

  const mcp = status?.mcp;
  const servers = mcp?.servers || [];

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

      {/* Connection */}
      <div className="space-y-3">
        <SectionTitle Icon={IconGlobe}>Connection</SectionTitle>
        <Block>
          {statusLoading && !status ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner /> Checking the MCP server and OpenAI…
            </p>
          ) : status ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-fg">
                    MCP {servers.length > 1 ? `servers (${servers.length})` : "server"}
                  </p>
                  <Chip tone={mcp?.connected ? "success" : "accent"}>
                    {mcp?.connected ? "Connected" : mcp?.configured ? "Unreachable" : "Not configured"}
                  </Chip>
                </div>

                <ul className="mt-1.5 space-y-1.5">
                  {servers.length ? (
                    servers.map((s) => (
                      <li key={s.name} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.connected ? "bg-success" : "bg-danger"}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-fg">
                            <strong>{s.name}</strong>
                            <span className="text-fg-muted"> · {s.target}</span>
                            {s.info?.name ? <span className="text-fg-subtle"> · {s.info.name} {s.info.version}</span> : null}
                          </p>
                          {s.connected ? (
                            s.tools?.length ? <p className="text-fg-subtle break-words">{s.tools.join(", ")}</p> : null
                          ) : (
                            <p className="text-danger">{s.error || "Not connected."}</p>
                          )}
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-danger">{mcp?.error || "No MCP server is configured."}</li>
                  )}
                </ul>

                {mcp?.connected ? (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    {[
                      ["Search", mcp.routing?.searchWeb || mcp.capabilities?.searchWeb || "none"],
                      ["News", mcp.routing?.searchNews || "web search with a recency window"],
                      ["Fetch", mcp.routing?.fetchPage || "none"],
                    ].map(([label, value]) => (
                      <React.Fragment key={label}>
                        <dt className="text-fg-subtle">{label}</dt>
                        <dd className="text-fg break-words">{value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                ) : null}

                {mcp?.notes?.map((n, i) => (
                  <p key={i} className="mt-1 text-xs text-warning">
                    {n}
                  </p>
                ))}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">OpenAI</p>
                  <p className="text-xs text-fg-muted">{status.ai?.configured ? `Model ${status.ai.model}` : "OPENAI_API_KEY is not set on the server."}</p>
                </div>
                <Chip tone={status.ai?.configured ? "success" : "accent"}>{status.ai?.configured ? "Configured" : "Missing"}</Chip>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">Scheduler</p>
                  <p className="text-xs text-fg-muted">{status.scheduler?.configured ? "CRON_SECRET is set; scheduled briefings run on the server." : "Set CRON_SECRET (and the cron in vercel.json) to enable scheduled briefings."}</p>
                </div>
                <Chip tone={status.scheduler?.configured ? "success" : "accent"}>{status.scheduler?.configured ? "Active" : "Inactive"}</Chip>
              </div>
            </div>
          ) : (
            <Banner tone="warning">Could not check the connection.</Banner>
          )}
          <ActionButton Icon={IconRefresh} onClick={onRefreshStatus} busy={statusLoading} size="sm">
            Check again
          </ActionButton>
        </Block>
      </div>

      <p className="text-[11px] text-fg-subtle flex items-center gap-1.5">
        <IconSettings className="w-3 h-3" />
        API keys never leave the server. The app talks to the MCP server and OpenAI only from its API routes.
      </p>
    </div>
  );
}
