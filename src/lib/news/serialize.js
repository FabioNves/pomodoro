// Shapes the API returns to the client. Server only.

import { STALL_RESUME_MS } from "@/lib/news/generate";

function id(value) {
  return value ? String(value) : null;
}

function plain(value) {
  return value && typeof value.toObject === "function" ? value.toObject() : value;
}

function sourceDto(s) {
  return {
    url: s.url,
    title: s.title || "",
    publisher: s.publisher || "",
    publishedAt: s.publishedAt || null,
  };
}

function groupedDto(items) {
  return (items || []).map((item) => ({
    title: item.title,
    summary: item.summary,
    sources: (item.sources || []).map(sourceDto),
  }));
}

export function statsDto(raw) {
  const stats = plain(raw) || {};
  return {
    queries: stats.queries || 0,
    searchesOk: stats.searchesOk || 0,
    searchesFailed: stats.searchesFailed || 0,
    resultsRetrieved: stats.resultsRetrieved || 0,
    uniqueArticles: stats.uniqueArticles || 0,
    pagesFetched: stats.pagesFetched || 0,
    candidatesSent: stats.candidatesSent || 0,
    storiesDropped: stats.storiesDropped || 0,
    model: stats.model || "",
    mcpServer: stats.mcpServer || "",
    durationMs: stats.durationMs || 0,
    warnings: stats.warnings || [],
  };
}

export function storyDto(story, { savedIds = new Set(), feedbackById = new Map() } = {}) {
  const sid = id(story._id);
  return {
    id: sid,
    briefingId: id(story.briefing),
    section: story.section,
    rank: story.rank,
    headline: story.headline,
    summary: story.summary,
    whyItMatters: story.whyItMatters || "",
    isAnalysis: Boolean(story.isAnalysis),
    topics: story.topics || [],
    suggestedTopics: story.suggestedTopics || [],
    url: story.url,
    publisher: story.publisher || "",
    publishedAt: story.publishedAt || null,
    sources: (story.sources || []).map(sourceDto),
    edition: story.edition || "",
    language: story.language || "",
    outputLanguage: story.outputLanguage || "",
    countries: story.countries || [],
    saved: savedIds.has(sid),
    feedback: feedbackById.get(sid) || null,
  };
}

function sectionsOf(stories, opts) {
  const sections = { top: [], worthKnowing: [], missed: [] };
  for (const s of [...stories].sort((x, y) => x.rank - y.rank)) {
    const dto = storyDto(s, opts);
    (sections[dto.section] || sections.top).push(dto);
  }
  return sections;
}

export function briefingSummaryDto(b) {
  const editions = b.editions || [];
  const finished = editions.filter((e) => ["ready", "empty", "failed"].includes(e.status)).length;
  const waiting = editions.some((e) => e.status === "pending");
  const working = editions.some((e) => e.status === "generating");
  const beat = new Date(b.heartbeatAt || b.startedAt || b.createdAt || 0).getTime();
  return {
    id: id(b._id),
    kind: b.kind,
    status: b.status,
    trigger: b.trigger,
    periodKey: b.periodKey,
    timezone: b.timezone,
    title: b.title || "",
    storyCount: b.storyCount || 0,
    createdAt: b.createdAt,
    completedAt: b.completedAt || null,
    error: b.error || "",
    errorCode: b.errorCode || "",
    editionsTotal: editions.length,
    editionsDone: finished,
    languages: [...new Set(editions.map((e) => e.language || ""))],
    // Editions are waiting, nothing is working on them and nothing has
    // touched the run for a while: the hand-off between invocations was lost
    // and the client may ask for the next edition itself.
    stalled: b.status === "generating" && waiting && !working && Date.now() - beat > STALL_RESUME_MS,
  };
}

function editionDto(e, stories, opts) {
  return {
    key: e.key,
    countries: e.countries || [],
    language: e.language || "",
    outputLanguage: e.outputLanguage || "",
    coverage: e.coverage || "topics",
    status: e.status,
    storyCount: e.storyCount || 0,
    intro: e.intro || "",
    note: e.note || "",
    highlights: groupedDto(e.highlights),
    trends: groupedDto(e.trends),
    error: e.error || "",
    errorCode: e.errorCode || "",
    stats: statsDto(e.stats),
    startedAt: e.startedAt || null,
    completedAt: e.completedAt || null,
    sections: sectionsOf(stories, opts),
  };
}

export function briefingDto(b, stories = [], opts = {}) {
  const editions = b.editions || [];
  return {
    ...briefingSummaryDto(b),
    intro: b.intro || "",
    note: b.note || "",
    highlights: groupedDto(b.highlights),
    trends: groupedDto(b.trends),
    // Every story of the run, for single-edition and older briefings.
    sections: sectionsOf(stories, opts),
    stats: statsDto(b.stats),
    editions: editions.map((e) =>
      editionDto(e, stories.filter((s) => (s.edition || "") === e.key), opts),
    ),
  };
}

export function savedStoryDto(s) {
  return {
    id: id(s._id),
    storyId: id(s.story),
    briefingId: id(s.briefing),
    headline: s.headline,
    summary: s.summary,
    url: s.url,
    publisher: s.publisher || "",
    publishedAt: s.publishedAt || null,
    topics: s.topics || [],
    language: s.language || "",
    outputLanguage: s.outputLanguage || "",
    countries: s.countries || [],
    savedAt: s.createdAt,
  };
}
