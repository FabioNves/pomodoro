"use client";

// The news briefing screen: current briefing, history, saved stories,
// topics and settings, with "generate now" and refresh. Data comes from
// /api/news/*; the tab and briefing kind live in the query string so links
// and reloads keep their place.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { newsApi, browserTimeZone } from "@/lib/news/client";
import BriefingView from "@/components/news/BriefingView";
import BriefingHistory from "@/components/news/BriefingHistory";
import SavedStories from "@/components/news/SavedStories";
import TopicsManager from "@/components/news/TopicsManager";
import NewsSettings from "@/components/news/NewsSettings";
import {
  ActionButton,
  Banner,
  IconBookmark,
  IconHistory,
  IconNews,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconTag,
} from "@/components/news/newsUi";

const TABS = [
  { key: "briefing", label: "Briefing", Icon: IconNews },
  { key: "history", label: "History", Icon: IconHistory },
  { key: "saved", label: "Saved", Icon: IconBookmark },
  { key: "topics", label: "Topics", Icon: IconTag },
  { key: "settings", label: "Settings", Icon: IconSettings },
];
const KINDS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];
const POLL_MS = 3000;
const POLL_MAX = 140; // 7 minutes

export default function NewsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const kindParam = searchParams.get("kind");
  // A briefing opened from History is pinned by id so switching kind or
  // reloading the page does not replace it with the latest one.
  const briefingIdParam = searchParams.get("briefing");
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : "briefing";
  const kind = KINDS.some((k) => k.key === kindParam) ? kindParam : "daily";

  const setParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) params.delete(k);
        else params.set(k, v);
      }
      router.replace(`/news?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [nextDelivery, setNextDelivery] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [savedKey, setSavedKey] = useState(0);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);
  // Bumped whenever polling is cancelled or a newer load starts, so a reply
  // that arrives late cannot overwrite what the user is looking at now.
  const pollIdRef = useRef(0);
  const loadIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    pollIdRef.current += 1; // abandons any tick already in flight
    setGenerating(false);
  }, []);

  /* ── polling while a briefing is generating ─────────── */
  const pollBriefing = useCallback(
    (id) => {
      if (pollRef.current) clearTimeout(pollRef.current);
      const myPoll = (pollIdRef.current += 1);
      const current = () => mountedRef.current && pollIdRef.current === myPoll;
      setGenerating(true);
      let attempts = 0;
      let failures = 0;
      const tick = async () => {
        if (!current()) return;
        attempts += 1;
        try {
          const data = await newsApi(`/api/news/briefings?id=${encodeURIComponent(id)}`);
          if (!current()) return;
          setBriefing(data.briefing);
          if (data.briefing.status !== "generating") {
            stopPolling();
            setHistoryKey((k) => k + 1);
            if (data.briefing.status === "ready") toast.success("Your briefing is ready.");
            else if (data.briefing.status === "failed") toast.error("The briefing could not be generated.");
            return;
          }
        } catch (e) {
          if (!current()) return;
          failures += 1;
          if (failures > 5) {
            stopPolling();
            toast.error(e.message || "Lost contact with the server.");
            return;
          }
        }
        if (attempts >= POLL_MAX) {
          stopPolling();
          toast.error("Generation is taking longer than expected. Check History in a minute.");
          return;
        }
        pollRef.current = setTimeout(tick, POLL_MS);
      };
      tick();
    },
    [stopPolling],
  );

  /* ── loaders ────────────────────────────────────────── */
  const loadLatest = useCallback(
    async (k = kind) => {
      const myLoad = (loadIdRef.current += 1);
      setBriefingLoading(true);
      try {
        // The Daily view also covers custom-schedule briefings.
        const kinds = k === "weekly" ? "weekly" : k === "monthly" ? "monthly" : "daily,custom";
        const data = await newsApi(`/api/news/briefings/latest?kinds=${kinds}`);
        if (!mountedRef.current || loadIdRef.current !== myLoad) return;
        setBriefing(data.briefing);
        if (data.briefing?.status === "generating") pollBriefing(data.briefing.id);
        else stopPolling();
      } catch (e) {
        if (loadIdRef.current !== myLoad) return;
        toast.error(e.message || "Could not load the briefing.");
      } finally {
        if (mountedRef.current && loadIdRef.current === myLoad) setBriefingLoading(false);
      }
    },
    [kind, pollBriefing, stopPolling],
  );

  const loadById = useCallback(
    async (id) => {
      const myLoad = (loadIdRef.current += 1);
      setBriefingLoading(true);
      try {
        const data = await newsApi(`/api/news/briefings?id=${encodeURIComponent(id)}`);
        if (!mountedRef.current || loadIdRef.current !== myLoad) return;
        setBriefing(data.briefing);
        if (data.briefing?.status === "generating") pollBriefing(data.briefing.id);
        else stopPolling();
      } catch (e) {
        if (loadIdRef.current !== myLoad) return;
        toast.error(e.message || "Could not open the briefing.");
        setParams({ briefing: null });
      } finally {
        if (mountedRef.current && loadIdRef.current === myLoad) setBriefingLoading(false);
      }
    },
    [pollBriefing, stopPolling, setParams],
  );

  const loadTopics = useCallback(async () => {
    try {
      const data = await newsApi("/api/news/topics");
      if (!mountedRef.current) return;
      setTopics(data.topics);
      setSuggested(data.suggested || []);
    } catch (e) {
      toast.error(e.message || "Could not load topics.");
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const data = await newsApi(`/api/news/preferences?tz=${encodeURIComponent(browserTimeZone())}`);
      if (!mountedRef.current) return;
      setPreferences(data.preferences);
      setNextDelivery(data.nextDelivery);
      if (data.suggestedTopics) setSuggested(data.suggestedTopics);
    } catch (e) {
      toast.error(e.message || "Could not load settings.");
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await newsApi("/api/news/status");
      if (!mountedRef.current) return;
      setStatus(data);
      if (data.nextDelivery !== undefined) setNextDelivery(data.nextDelivery);
    } catch (e) {
      toast.error(e.message || "Could not check the connection.");
    } finally {
      if (mountedRef.current) setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
    loadPreferences();
  }, [loadTopics, loadPreferences]);

  useEffect(() => {
    if (briefingIdParam) loadById(briefingIdParam);
    else loadLatest(kind);
  }, [kind, briefingIdParam]);

  useEffect(() => {
    if (tab === "settings" && !status && !statusLoading) loadStatus();
  }, [tab]);

  /* ── actions ────────────────────────────────────────── */
  const generate = async () => {
    if (generating) return;
    if (!topics.length && preferences && !preferences.includeWorthKnowing && !preferences.customInterests) {
      toast.error("Add at least one topic first.");
      setParams({ tab: "topics" });
      return;
    }
    setGenerating(true);
    try {
      const data = await newsApi("/api/news/briefings/generate", { method: "POST", body: { kind } });
      if (!mountedRef.current) return;
      loadIdRef.current += 1; // this briefing wins over any load in flight
      setBriefing({ ...data.briefing, sections: { top: [], worthKnowing: [], missed: [] } });
      setParams({ tab: "briefing", briefing: null });
      pollBriefing(data.briefing.id);
    } catch (e) {
      if (!mountedRef.current) return;
      setGenerating(false);
      if (e.code === "already_running") {
        toast("A briefing is already being generated.");
        loadLatest(kind);
      } else {
        toast.error(e.message || "Could not start the briefing.");
      }
    }
  };

  const patchStory = (storyId, patch) => {
    setBriefing((b) => {
      if (!b?.sections) return b;
      const sections = {};
      for (const [key, list] of Object.entries(b.sections)) {
        sections[key] = list.map((s) => (s.id === storyId ? { ...s, ...patch } : s));
      }
      return { ...b, sections };
    });
  };

  const feedback = async (story, value) => {
    patchStory(story.id, { feedback: value });
    try {
      await newsApi("/api/news/stories/feedback", { method: "POST", body: { storyId: story.id, value } });
    } catch (e) {
      patchStory(story.id, { feedback: story.feedback });
      toast.error(e.message || "Could not save feedback.");
    }
  };

  const save = async (story) => {
    const next = !story.saved;
    patchStory(story.id, { saved: next });
    try {
      await newsApi("/api/news/stories/saved", { method: next ? "POST" : "DELETE", body: { storyId: story.id } });
      setSavedKey((k) => k + 1);
      toast.success(next ? "Story saved." : "Removed from saved stories.");
    } catch (e) {
      patchStory(story.id, { saved: story.saved });
      toast.error(e.message || "Could not update saved stories.");
    }
  };

  const addTopic = async (name, source = "manual") => {
    setBusy(true);
    try {
      const data = await newsApi("/api/news/topics", { method: "POST", body: { name, source } });
      setTopics((prev) => (prev.some((t) => t.id === data.topic.id) ? prev : [...prev, data.topic]));
      toast.success(data.created ? `Following “${data.topic.name}”.` : `Already following “${data.topic.name}”.`);
      return true;
    } catch (e) {
      toast.error(e.message || "Could not follow the topic.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeTopic = async (topic) => {
    const previous = topics;
    setTopics((prev) => prev.filter((t) => t.id !== topic.id));
    try {
      await newsApi("/api/news/topics", { method: "DELETE", body: { id: topic.id } });
    } catch (e) {
      setTopics(previous);
      toast.error(e.message || "Could not remove the topic.");
    }
  };

  const savePreferences = async (update) => {
    setSaving(true);
    try {
      const data = await newsApi("/api/news/preferences", { method: "PUT", body: update });
      setPreferences(data.preferences);
      setNextDelivery(data.nextDelivery);
      toast.success("Settings saved.");
      return true;
    } catch (e) {
      const detail = e.details?.[0] ? ` (${e.details[0].path}: ${e.details[0].message})` : "";
      toast.error(`${e.message || "Could not save settings."}${detail}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const followedTopics = new Set(topics.map((t) => t.name.toLowerCase()));
  const mcpProblem = status?.mcp && !status.mcp.connected;
  const aiProblem = status?.ai && !status.ai.configured;

  return (
    <div className="container mx-auto px-4 pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
            News briefing
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Real stories retrieved from the web through MCP, ranked and summarised for your topics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 bg-surface-2/80 px-1 py-1 rounded-lg border border-edge">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setParams({ kind: k.key, tab: "briefing", briefing: null })}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  kind === k.key ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <ActionButton
            Icon={IconRefresh}
            onClick={() => (briefingIdParam ? setParams({ tab: "briefing", briefing: null }) : loadLatest(kind))}
            busy={briefingLoading && !generating}
            title="Reload the latest briefing"
          >
            Refresh
          </ActionButton>
          <ActionButton tone="primary" Icon={IconSparkles} onClick={generate} busy={generating} title={`Generate a ${kind} briefing now`}>
            Generate now
          </ActionButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-2/80 px-1.5 py-1 rounded-lg border border-edge mb-5 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setParams({ tab: t.key })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <t.Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {(mcpProblem || aiProblem) && tab !== "settings" ? (
        <div className="mb-4">
          <Banner
            tone="warning"
            action={
              <ActionButton size="sm" onClick={() => setParams({ tab: "settings" })}>
                Open settings
              </ActionButton>
            }
          >
            {mcpProblem ? "The MCP server is not reachable, so briefings cannot retrieve news. " : ""}
            {aiProblem ? "OPENAI_API_KEY is not configured on the server." : ""}
          </Banner>
        </div>
      ) : null}

      <div className="bg-surface/70 backdrop-blur-sm rounded-2xl border border-edge shadow-md p-4 sm:p-6 transition-colors duration-300">
        {tab === "briefing" && briefingIdParam && briefing ? (
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-fg-muted">
            <span>Viewing a briefing from your history.</span>
            <button type="button" onClick={() => setParams({ briefing: null })} className="font-medium text-primary hover:underline">
              Back to latest
            </button>
          </div>
        ) : null}
        {tab === "briefing" ? (
          briefingLoading && !briefing ? (
            <p className="text-sm text-fg-muted">Loading your briefing…</p>
          ) : (
            <BriefingView
              briefing={briefing}
              onGenerate={generate}
              onFeedback={feedback}
              onSave={save}
              onFollow={(name) => addTopic(name, "story")}
              followedTopics={followedTopics}
              busy={busy}
              generating={generating}
            />
          )
        ) : null}

        {tab === "history" ? (
          <BriefingHistory
            activeId={briefing?.id}
            refreshKey={historyKey}
            onOpen={(summary) =>
              setParams({
                tab: "briefing",
                kind: KINDS.some((k) => k.key === summary.kind) ? summary.kind : "daily",
                briefing: summary.id,
              })
            }
          />
        ) : null}

        {tab === "saved" ? <SavedStories refreshKey={savedKey} onChanged={(storyId, saved) => patchStory(storyId, { saved })} /> : null}

        {tab === "topics" ? (
          <TopicsManager topics={topics} suggested={suggested} onAdd={(name) => addTopic(name, "manual")} onRemove={removeTopic} busy={busy} />
        ) : null}

        {tab === "settings" ? (
          <NewsSettings
            preferences={preferences}
            onSave={savePreferences}
            saving={saving}
            status={status}
            statusLoading={statusLoading}
            onRefreshStatus={loadStatus}
            nextDelivery={nextDelivery}
          />
        ) : null}
      </div>
    </div>
  );
}
