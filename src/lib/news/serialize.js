// Shapes the API returns to the client. Server only.

function id(value) {
  return value ? String(value) : null;
}

function sourceDto(s) {
  return {
    url: s.url,
    title: s.title || "",
    publisher: s.publisher || "",
    publishedAt: s.publishedAt || null,
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
    saved: savedIds.has(sid),
    feedback: feedbackById.get(sid) || null,
  };
}

export function briefingSummaryDto(b) {
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
  };
}

export function briefingDto(b, stories = [], opts = {}) {
  const sections = { top: [], worthKnowing: [], missed: [] };
  for (const s of [...stories].sort((x, y) => x.rank - y.rank)) {
    const dto = storyDto(s, opts);
    (sections[dto.section] || sections.top).push(dto);
  }
  const stats = b.stats?.toObject ? b.stats.toObject() : b.stats || {};
  return {
    ...briefingSummaryDto(b),
    intro: b.intro || "",
    note: b.note || "",
    highlights: (b.highlights || []).map((h) => ({ title: h.title, summary: h.summary, sources: (h.sources || []).map(sourceDto) })),
    trends: (b.trends || []).map((t) => ({ title: t.title, summary: t.summary, sources: (t.sources || []).map(sourceDto) })),
    sections,
    stats: {
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
    },
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
    savedAt: s.createdAt,
  };
}
