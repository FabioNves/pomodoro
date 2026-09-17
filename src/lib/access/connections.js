// Connection health for the admin page. Server only.
//
// Everything the app depends on, in one report: the MCP servers and their
// tools, OpenAI, the scheduler secret, the database, the sign-in
// configuration, and when each of them was last used. Names of things and
// whether a key is set, never a key itself.

import mongoose from "mongoose";
import { connectToDB } from "@/lib/db";
import { getMcpStatus, resetRouting } from "@/lib/mcp";
import { isOpenAiConfigured, getAiConfig } from "@/lib/ai";
import Briefing from "@/models/Briefing";
import UsageEvent from "@/models/UsageEvent";
import { adminEmails } from "@/lib/access/server";

const MCP_TIMEOUT_MS = 15000;

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function briefingSummary(b) {
  if (!b) return null;
  return {
    id: String(b._id),
    kind: b.kind,
    status: b.status,
    trigger: b.trigger,
    errorCode: b.errorCode || null,
    at: b.updatedAt || b.createdAt || null,
  };
}

function callSummary(e) {
  if (!e) return null;
  return { at: e.at, ok: e.ok !== false, model: e.model || "" };
}

async function lastSync() {
  await connectToDB();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const select = "kind status trigger errorCode createdAt updatedAt";
  const [lastBriefing, lastScheduled, lastOpenAi, lastMcp, failedToday, callsToday] = await Promise.all([
    Briefing.findOne().sort({ createdAt: -1 }).select(select).lean(),
    Briefing.findOne({ trigger: "scheduled" }).sort({ createdAt: -1 }).select(select).lean(),
    UsageEvent.findOne({ kind: "external", provider: "openai" }).sort({ at: -1 }).select("at ok model").lean(),
    UsageEvent.findOne({ kind: "external", provider: "mcp" }).sort({ at: -1 }).select("at ok model").lean(),
    UsageEvent.countDocuments({ kind: "external", ok: false, at: { $gte: dayStart } }),
    UsageEvent.countDocuments({ kind: "external", at: { $gte: dayStart } }),
  ]);
  return {
    lastBriefing: briefingSummary(lastBriefing),
    lastScheduledBriefing: briefingSummary(lastScheduled),
    lastOpenAiCall: callSummary(lastOpenAi),
    lastMcpCall: callSummary(lastMcp),
    externalCallsToday: callsToday,
    externalFailuresToday: failedToday,
  };
}

/**
 * @param {{ refresh?: boolean }} [opts] refresh: forget the cached tool
 *   routing and probe the MCP servers again.
 */
export async function connectionStatus({ refresh = false } = {}) {
  if (refresh) resetRouting();
  const timeout = new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          configured: true,
          connected: false,
          servers: [],
          routing: {},
          error: "Timed out while contacting the MCP server.",
          errorCode: "timeout",
        }),
      MCP_TIMEOUT_MS,
    ),
  );
  const [mcp, sync] = await Promise.all([
    Promise.race([getMcpStatus(), timeout]),
    lastSync().catch((error) => {
      console.warn("[admin] could not read sync history:", error?.message || error);
      return null;
    }),
  ]);
  const { model, baseUrl } = getAiConfig();
  return {
    checkedAt: new Date().toISOString(),
    mcp,
    ai: { configured: isOpenAiConfigured(), model, host: hostOf(baseUrl) },
    scheduler: { configured: Boolean((process.env.CRON_SECRET || "").trim()), cron: "0 6 * * * (vercel.json)" },
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name || null,
      configured: Boolean((process.env.MONGO_URI || "").trim()),
    },
    auth: {
      jwtSecret: Boolean((process.env.JWT_SECRET || "").trim()),
      googleClientId: Boolean((process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim()),
      adminEmails: adminEmails(),
    },
    desktop: {
      latestVersion: (process.env.DESKTOP_LATEST_VERSION || "").trim() || null,
      downloadUrl: (process.env.DESKTOP_DOWNLOAD_URL || "").trim() || null,
    },
    sync,
  };
}
