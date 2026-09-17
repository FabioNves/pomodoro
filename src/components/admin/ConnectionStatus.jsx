"use client";

// The Connection report: MCP servers and their tools, OpenAI, the
// scheduler, and (in the admin page) the database, sign-in configuration,
// desktop release and last activity. Reads the shape returned by
// /api/admin/connections; /api/news/status returns the same to the admin.

import React from "react";
import { ActionButton, Banner, Chip, IconRefresh, Spinner } from "@/components/news/newsUi";
import { formatDateTime, relativeTime } from "@/components/admin/adminUi";

function Row({ title, hint, chip, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-fg">{title}</p>
        {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
        {children}
      </div>
      {chip}
    </div>
  );
}

function briefingLine(b) {
  if (!b) return "None yet.";
  return `${b.kind} · ${b.status}${b.errorCode ? ` (${b.errorCode})` : ""} · ${relativeTime(b.at)}`;
}

function callLine(c) {
  if (!c) return "No calls recorded yet.";
  return `${c.ok ? "ok" : "failed"}${c.model ? ` · ${c.model}` : ""} · ${relativeTime(c.at)}`;
}

export default function ConnectionStatus({ status, loading, onRefresh, extended = false }) {
  const mcp = status?.mcp;
  const servers = mcp?.servers || [];

  return (
    <div className="space-y-3">
      {loading && !status ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner /> Checking the MCP server and OpenAI…
        </p>
      ) : status ? (
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-fg">MCP {servers.length > 1 ? `servers (${servers.length})` : "server"}</p>
              <Chip tone={mcp?.connected ? "success" : "accent"}>
                {mcp?.connected ? "Connected" : mcp?.configured ? "Unreachable" : "Not configured"}
              </Chip>
            </div>

            <ul className="mt-1.5 space-y-1.5">
              {servers.length ? (
                servers.map((s) => (
                  <li key={s.name} className="flex items-start gap-2 text-xs">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.connected ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-fg">
                        <strong>{s.name}</strong>
                        <span className="text-fg-muted"> · {s.target}</span>
                        {s.info?.name ? (
                          <span className="text-fg-subtle">
                            {" "}
                            · {s.info.name} {s.info.version}
                          </span>
                        ) : null}
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

          <Row
            title="OpenAI"
            hint={status.ai?.configured ? `Model ${status.ai.model}${status.ai.host ? ` · ${status.ai.host}` : ""}` : "OPENAI_API_KEY is not set on the server."}
            chip={<Chip tone={status.ai?.configured ? "success" : "accent"}>{status.ai?.configured ? "Configured" : "Missing"}</Chip>}
          />
          <Row
            title="Scheduler"
            hint={
              status.scheduler?.configured
                ? `CRON_SECRET is set; scheduled briefings run on the server${status.scheduler.cron ? ` (${status.scheduler.cron})` : ""}.`
                : "Set CRON_SECRET (and the cron in vercel.json) to enable scheduled briefings."
            }
            chip={<Chip tone={status.scheduler?.configured ? "success" : "accent"}>{status.scheduler?.configured ? "Active" : "Inactive"}</Chip>}
          />

          {extended && status.database ? (
            <>
              <Row
                title="Database"
                hint={status.database.connected ? `MongoDB · ${status.database.name || "connected"}` : status.database.configured ? "MONGO_URI is set but there is no open connection." : "MONGO_URI is not set."}
                chip={<Chip tone={status.database.connected ? "success" : "accent"}>{status.database.connected ? "Connected" : "Down"}</Chip>}
              />
              <Row
                title="Sign-in"
                hint={`JWT secret ${status.auth?.jwtSecret ? "set" : "missing"} · Google client id ${status.auth?.googleClientId ? "set" : "missing"} · admin: ${(status.auth?.adminEmails || []).join(", ")}`}
                chip={<Chip tone={status.auth?.jwtSecret && status.auth?.googleClientId ? "success" : "accent"}>{status.auth?.jwtSecret && status.auth?.googleClientId ? "Configured" : "Incomplete"}</Chip>}
              />
              <Row
                title="Desktop release"
                hint={status.desktop?.latestVersion ? `Latest advertised build ${status.desktop.latestVersion}` : "DESKTOP_LATEST_VERSION is not set; the update banner stays hidden."}
                chip={<Chip tone={status.desktop?.latestVersion ? "success" : "neutral"}>{status.desktop?.latestVersion || "Unset"}</Chip>}
              />
              {status.sync ? (
                <div>
                  <p className="font-medium text-fg">Last activity</p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-fg-subtle">Briefing</dt>
                    <dd className="text-fg">{briefingLine(status.sync.lastBriefing)}</dd>
                    <dt className="text-fg-subtle">Scheduled run</dt>
                    <dd className="text-fg">{briefingLine(status.sync.lastScheduledBriefing)}</dd>
                    <dt className="text-fg-subtle">OpenAI call</dt>
                    <dd className="text-fg">{callLine(status.sync.lastOpenAiCall)}</dd>
                    <dt className="text-fg-subtle">MCP call</dt>
                    <dd className="text-fg">{callLine(status.sync.lastMcpCall)}</dd>
                    <dt className="text-fg-subtle">Today</dt>
                    <dd className="text-fg">
                      {status.sync.externalCallsToday} external calls
                      {status.sync.externalFailuresToday ? <span className="text-danger">, {status.sync.externalFailuresToday} failed</span> : null}
                    </dd>
                  </dl>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <Banner tone="warning">Could not check the connection.</Banner>
      )}
      <div className="flex items-center gap-3">
        <ActionButton Icon={IconRefresh} onClick={onRefresh} busy={loading} size="sm">
          Check again
        </ActionButton>
        {status?.checkedAt ? <span className="text-[11px] text-fg-subtle">Checked {formatDateTime(status.checkedAt)}</span> : null}
      </div>
    </div>
  );
}
