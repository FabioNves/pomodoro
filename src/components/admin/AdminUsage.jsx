"use client";

// Admin › Usage: requests and actions per day, active users, per-feature
// breakdown and external calls with their estimated cost.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { accessApi } from "@/lib/access/client";
import { SectionTitle, Spinner } from "@/components/news/newsUi";
import {
  EmptyRow,
  IconChart,
  Segmented,
  Stat,
  Table,
  Td,
  Tr,
  formatMoney,
  formatNumber,
  inputClass,
} from "@/components/admin/adminUi";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom" },
];

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface p-3 rounded-lg border border-edge text-xs">
      <p className="text-fg font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function AdminUsage() {
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState(isoDay(-13));
  const [to, setTo] = useState(isoDay(0));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom") {
        params.set("from", from);
        params.set("to", to);
      }
      setData(await accessApi(`/api/admin/usage?${params}`));
    } catch (error) {
      toast.error(error.message || "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => {
    if (range === "custom" && (!from || !to || from > to)) return;
    load();
  }, [load, range, from, to]);

  const chartData = useMemo(
    () =>
      (data?.days || []).map((d) => ({
        ...d,
        label: d.date.slice(5),
      })),
    [data],
  );
  const currency = data?.currency || "USD";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle Icon={IconChart}>Usage</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={RANGES} value={range} onChange={setRange} label="Date range" />
          {range === "custom" ? (
            <>
              <input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              <span className="text-xs text-fg-subtle">to</span>
              <input type="date" aria-label="To" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </>
          ) : null}
          {loading ? <Spinner /> : null}
        </div>
      </div>

      {data ? (
        <>
          <p className="text-xs text-fg-subtle">
            {data.range.from === data.range.to ? data.range.from : `${data.range.from} to ${data.range.to}`} · days in UTC · an active user made at least one signed-in request that day
          </p>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Requests" value={formatNumber(data.totals.requests)} hint="GET calls with a user" />
            <Stat label="Actions" value={formatNumber(data.totals.actions)} hint="Writes with a user" tone="primary" />
            <Stat label="Active users" value={formatNumber(data.totals.activeUsers)} hint="Distinct over the range" tone="success" />
            <Stat label="Sign-ups" value={formatNumber(data.totals.signups)} hint="New accounts" />
            <Stat label="External calls" value={formatNumber(data.totals.externalCalls)} hint="OpenAI + MCP" tone="accent" />
            <Stat label="Est. cost" value={formatMoney(data.totals.cost, currency)} hint="From token prices" tone="accent" />
          </div>

          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-sm font-semibold text-fg mb-2">Per day</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="label" stroke="var(--chart-axis)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--chart-axis)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="requests" name="Requests" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="actions" name="Actions" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activeUsers" name="Active users" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-fg">By day</p>
              <Table
                columns={["Day", { key: "r", label: "Requests", align: "right" }, { key: "a", label: "Actions", align: "right" }, { key: "u", label: "Active", align: "right" }, { key: "s", label: "Sign-ups", align: "right" }, { key: "x", label: "External", align: "right" }, { key: "c", label: "Cost", align: "right" }]}
                minWidth="34rem"
                caption="Usage per day"
              >
                {data.days.length ? (
                  [...data.days].reverse().map((d) => (
                    <Tr key={d.date}>
                      <Td className="whitespace-nowrap">{d.date}</Td>
                      <Td align="right">{formatNumber(d.requests)}</Td>
                      <Td align="right">{formatNumber(d.actions)}</Td>
                      <Td align="right">{formatNumber(d.activeUsers)}</Td>
                      <Td align="right">{formatNumber(d.signups)}</Td>
                      <Td align="right">{formatNumber(d.externalCalls)}</Td>
                      <Td align="right">{formatMoney(d.cost, currency)}</Td>
                    </Tr>
                  ))
                ) : (
                  <EmptyRow colSpan={7}>Nothing recorded in this range.</EmptyRow>
                )}
              </Table>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-fg">By feature</p>
                <Table columns={["Feature", { key: "r", label: "Requests", align: "right" }, { key: "a", label: "Actions", align: "right" }, { key: "u", label: "Users", align: "right" }]} minWidth="26rem" caption="Usage per feature">
                  {data.features.length ? (
                    data.features.map((f) => (
                      <Tr key={f.key}>
                        <Td>
                          {f.name}
                          <span className="text-fg-subtle text-xs"> · {f.key}</span>
                        </Td>
                        <Td align="right">{formatNumber(f.requests)}</Td>
                        <Td align="right">{formatNumber(f.actions)}</Td>
                        <Td align="right">{formatNumber(f.users)}</Td>
                      </Tr>
                    ))
                  ) : (
                    <EmptyRow colSpan={4}>No feature usage in this range.</EmptyRow>
                  )}
                </Table>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-fg">External API calls</p>
                <Table
                  columns={["Provider", "Model / tool", { key: "c", label: "Calls", align: "right" }, { key: "f", label: "Failed", align: "right" }, { key: "i", label: "Tokens in", align: "right" }, { key: "o", label: "Tokens out", align: "right" }, { key: "$", label: "Cost", align: "right" }]}
                  minWidth="36rem"
                  caption="External API calls"
                >
                  {data.external.length ? (
                    data.external.map((e) => (
                      <Tr key={`${e.provider}-${e.model}`}>
                        <Td className="capitalize">{e.provider}</Td>
                        <Td className="break-all">{e.model || "—"}</Td>
                        <Td align="right">{formatNumber(e.calls)}</Td>
                        <Td align="right">{e.failed ? <span className="text-danger">{formatNumber(e.failed)}</span> : "0"}</Td>
                        <Td align="right">{formatNumber(e.tokensIn)}</Td>
                        <Td align="right">{formatNumber(e.tokensOut)}</Td>
                        <Td align="right">{formatMoney(e.cost, currency)}</Td>
                      </Tr>
                    ))
                  ) : (
                    <EmptyRow colSpan={7}>No external calls in this range.</EmptyRow>
                  )}
                </Table>
                <p className="text-[11px] text-fg-subtle">
                  OpenAI cost is estimated from token counts and list prices (override with OPENAI_PRICE_PER_M). MCP calls are counted; set MCP_COST_PER_CALL to price them.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : !loading ? (
        <p className="text-sm text-fg-muted">No usage data.</p>
      ) : null}
    </div>
  );
}
