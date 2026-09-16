// AI service for the news briefing. Server only.
//
// This layer never touches the network for news: it receives structured,
// already-retrieved material (from src/lib/news via MCP) and returns
// structured decisions (queries to run, ranked and summarised stories,
// answers with citations). Sources are referenced by numeric id only.

import { chatJson, isOpenAiConfigured, getAiConfig, AiError } from "@/lib/ai/openai";
import {
  QUERY_PLAN_SCHEMA,
  DAILY_BRIEFING_SCHEMA,
  WEEKLY_BRIEFING_SCHEMA,
  FOLLOWUP_PLAN_SCHEMA,
  ANSWER_SCHEMA,
} from "@/lib/ai/schemas";
import { kindMeta, isRoundup } from "@/lib/news/kinds";
import { countryName, languageName } from "@/lib/news/locales";
import {
  QUERY_PLANNER_SYSTEM,
  BRIEFING_SYSTEM,
  FOLLOWUP_PLANNER_SYSTEM,
  ANSWER_SYSTEM,
  lengthGuide,
} from "@/lib/ai/prompts";

export { AiError, isOpenAiConfigured, getAiConfig };

function fmtDate(date) {
  if (!date) return "date unknown";
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? "date unknown" : d.toISOString().slice(0, 10);
}

function feedbackBlock(feedback = []) {
  if (!feedback.length) return "";
  const liked = feedback.filter((f) => f.value === "relevant" || f.value === "interesting");
  const disliked = feedback.filter((f) => f.value === "not_relevant" || f.value === "not_interested");
  const line = (f) => `- ${f.headline}${f.topics?.length ? ` (topics: ${f.topics.join(", ")})` : ""}${f.domain ? ` [${f.domain}]` : ""}`;
  const parts = [];
  if (liked.length) parts.push(`Stories the reader marked relevant or interesting:\n${liked.slice(0, 15).map(line).join("\n")}`);
  if (disliked.length) parts.push(`Stories the reader marked not relevant or not interested:\n${disliked.slice(0, 15).map(line).join("\n")}`);
  return parts.join("\n\n");
}

/** "Portugal", "Spain and Mexico", or "" for a worldwide edition. */
function placesText(countries = []) {
  const names = countries.map(countryName).filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Plan the searches for one edition of a briefing.
 * @returns {Promise<{ queries: {query, topic, purpose}[], model: string }>}
 */
export async function planSearchQueries({
  topics,
  customInterests,
  kind,
  majorNewsOnly,
  includeWorthKnowing,
  feedback = [],
  maxQueries,
  timeoutMs = 45000,
  retries = 2,
  deadlineAt = null,
  language = "",
  countries = [],
  coverage = "topics",
}) {
  const meta = kindMeta(kind);
  const longWindow = meta.window !== "day";
  const topicLines = topics.length ? topics.map((t) => `- ${t}`).join("\n") : "- (none)";
  const perTopic = majorNewsOnly ? 1 : longWindow ? 2 : topics.length > 8 ? 1 : 2;
  const broad = includeWorthKnowing ? (longWindow ? 3 : 2) : 0;
  const places = placesText(countries);
  const lang = languageName(language);

  const region = [];
  if (places) {
    region.push(`Region: ${places}. Look for news from and about ${places}, as its own press reports it.`);
    if (countries.length > 1) {
      region.push("The search cannot be limited to several countries at once, so name the country in each query and spread the queries across the countries.");
    }
  } else {
    region.push("Region: worldwide.");
  }
  if (lang) {
    region.push(`Write every query in ${lang}, the way a local reader would type it, even when the reader's topics are written in another language.`);
  }

  const ask =
    coverage === "top"
      ? `This edition covers the most important news of ${places || "the world"} for the period, whatever the reader follows: politics, the economy, society, major events. Produce up to ${maxQueries} broad queries (purpose "broad", topic "broad") that together would surface the stories a national front page would lead with. You may add one topic query (purpose "topic") for a reader's topic only where it is big news in this region.`
      : `Produce about ${perTopic} quer${perTopic === 1 ? "y" : "ies"} per topic (purpose "topic", topic set to the exact topic text as written in the list, even when the query itself is in another language) and ${broad} broad quer${broad === 1 ? "y" : "ies"} for major general developments (purpose "broad", topic "broad"). At most ${maxQueries} queries in total.`;

  const user = `Briefing type: ${meta.label.toLowerCase()}, covering ${meta.periodWords}
Today: ${new Date().toISOString().slice(0, 10)}
${region.join("\n")}

Reader's topics:
${topicLines}

Reader's own description of their interests: ${customInterests?.trim() ? customInterests.trim() : "(none given)"}
Major news only: ${majorNewsOnly ? "yes, skip minor updates" : "no"}

${feedbackBlock(feedback)}

${ask}`;

  const { data, model } = await chatJson({
    system: QUERY_PLANNER_SYSTEM,
    user,
    schema: QUERY_PLAN_SCHEMA,
    schemaName: "news_query_plan",
    maxTokens: 1500,
    timeoutMs,
    retries,
    deadlineAt,
  });

  const seen = new Set();
  const queries = [];
  for (const q of data.queries || []) {
    const query = String(q.query || "").trim();
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    const purpose = q.purpose === "broad" ? "broad" : "topic";
    queries.push({
      query,
      purpose,
      topic: purpose === "broad" ? "broad" : String(q.topic || "").trim() || topics[0] || "broad",
    });
    if (queries.length >= maxQueries) break;
  }
  return { queries, model };
}

function candidateBlock(candidates, { excerptChars }) {
  return candidates
    .map((c) => {
      const body = (c.excerpt || c.snippet || "").slice(0, excerptChars);
      const hits = c.hits?.length ? ` | matched searches for: ${c.hits.join(", ")}` : "";
      return `[${c.id}] ${c.title || "(untitled)"}
source: ${c.publisher || c.domain} | published: ${fmtDate(c.publishedAt)}${c.publishedAt ? "" : " (not provided by source metadata)"}${hits}
${body}`;
    })
    .join("\n\n");
}

/** Language and region instructions shared by the briefing prompt. */
function editionBlock({ outputLanguage, sourceLanguage, countries, coverage }) {
  const out = languageName(outputLanguage) || "English";
  const src = languageName(sourceLanguage);
  const places = placesText(countries);
  const lines = [];

  lines.push(
    `LANGUAGE: Write the whole briefing in ${out}: intro, note, every headline, summary, "why it matters", development and trend. Keep names of people, organisations and places as the sources write them.`,
  );
  if (src && sourceLanguage !== outputLanguage) {
    lines.push(
      `The material is mostly in ${src}; translate it faithfully into ${out}. Do not put translated words in quotation marks: a quotation must be the exact words of a source, so report translated statements as paraphrase.`,
    );
  } else if (!src) {
    lines.push(`Some material may be in other languages; translate what you use into ${out}, and never put translated words in quotation marks.`);
  }
  if (places) {
    lines.push(
      `REGION: This edition covers ${places}. Choose stories that happened in or matter to ${places}; leave out items with no bearing on it.`,
    );
  }
  if (coverage === "top") {
    lines.push(
      `COVERAGE: The most important news of ${places || "the world"} for the period, judged by significance to people there rather than by the reader's topics. The "topics" field of a story lists a reader's topic only where one genuinely applies; it is usually empty here.`,
    );
  }
  return lines.join("\n");
}

/**
 * Rank, de-duplicate and summarise retrieved material into one edition.
 * @returns {Promise<{ data: object, model: string }>}
 */
export async function synthesizeBriefing({
  kind,
  candidates,
  topics,
  customInterests,
  storyCount,
  briefingLength,
  majorNewsOnly,
  includeWorthKnowing,
  feedback = [],
  recentlyShown = [],
  periodLabel,
  timeoutMs = 120000,
  retries = 2,
  deadlineAt = null,
  outputLanguage = "en",
  sourceLanguage = "",
  countries = [],
  coverage = "topics",
}) {
  const meta = kindMeta(kind);
  const roundup = isRoundup(kind);
  const excerptChars = briefingLength === "long" ? 2200 : briefingLength === "short" ? 1200 : 1600;
  const schema = roundup ? WEEKLY_BRIEFING_SCHEMA : DAILY_BRIEFING_SCHEMA;

  const user = `Reader's topics: ${topics.length ? topics.join("; ") : "(none)"}
Reader's own description of their interests: ${customInterests?.trim() || "(none)"}
Briefing: ${meta.label.toUpperCase()} covering ${periodLabel}. Today is ${new Date().toISOString().slice(0, 10)}.
Target: ${storyCount} top stories (fewer if the material does not support that many; never pad).
${lengthGuide(briefingLength)}
Major news only: ${majorNewsOnly ? "yes" : "no"}
Worth knowing section: ${includeWorthKnowing ? "yes, up to 3 items outside the reader's topics" : "no, leave it empty"}
${roundup ? `Roundup format for ${meta.periodWords}: first identify the 3-5 biggest developments of the period, grouping related items, then the top individual stories, then trends, then quieter stories the reader may have missed.` : "Daily format: top stories, worth knowing, and trends only when several items point the same way."}
${meta.window === "month" ? "This covers a whole month, so the material below is broad and uneven. Select on importance and lasting significance rather than recency: a major development from three weeks ago outranks a minor one from yesterday. Where the sources show what came of an earlier story, say so." : ""}
${meta.window === "week" ? "Select on importance across the week rather than on recency alone." : ""}

${editionBlock({ outputLanguage, sourceLanguage, countries, coverage })}

${feedbackBlock(feedback)}

${recentlyShown.length ? `Already shown to the reader recently (skip unless there is a real update):\n${recentlyShown.slice(0, 25).map((t) => `- ${t}`).join("\n")}` : ""}

RETRIEVED MATERIAL (${candidates.length} items):

${candidateBlock(candidates, { excerptChars })}`;

  const { data, model } = await chatJson({
    system: BRIEFING_SYSTEM,
    user,
    schema,
    schemaName: roundup ? "weekly_briefing" : "daily_briefing",
    maxTokens: briefingLength === "long" ? 9000 : 6000,
    timeoutMs,
    retries,
    deadlineAt,
  });
  return { data, model };
}

/** Decide whether a follow-up question needs fresh searches. */
export async function planFollowup({ story, question, sourceTitles, deadlineAt = null }) {
  const lang = languageName(story.language);
  const places = placesText(story.countries || []);
  const user = `Story headline: ${story.headline}
Story summary: ${story.summary}
Sources already available: ${sourceTitles.length ? sourceTitles.map((t) => `- ${t}`).join("\n") : "(none)"}
${places ? `The story comes from news about ${places}.` : ""}
${lang ? `Its sources are in ${lang}; write the queries in ${lang}.` : ""}

Reader's question: ${question}`;
  const { data } = await chatJson({
    system: FOLLOWUP_PLANNER_SYSTEM,
    user,
    schema: FOLLOWUP_PLAN_SCHEMA,
    schemaName: "followup_plan",
    maxTokens: 600,
    timeoutMs: 20000,
    retries: 1,
    deadlineAt,
  });
  const queries = (data.queries || []).map((q) => String(q).trim()).filter(Boolean).slice(0, 3);
  return {
    needsSearch: Boolean(data.needsSearch) && queries.length > 0,
    queries,
    recencyDays: Math.min(365, Math.max(1, Number(data.recencyDays) || 30)),
  };
}

/** Answer a follow-up question from the given sources. */
export async function answerStoryQuestion({ story, question, sources, deadlineAt = null }) {
  const sourceBlock = sources
    .map((s) => `[${s.id}] ${s.title || "(untitled)"} — ${s.publisher || s.domain}, ${fmtDate(s.publishedAt)}\n${(s.excerpt || s.snippet || "").slice(0, 2500)}`)
    .join("\n\n");
  // Answer in the language the reader asked in; the briefing's language is
  // the tie-breaker for a question too short to tell.
  const out = languageName(story.outputLanguage);
  const user = `Story: ${story.headline}
Briefing summary of the story: ${story.summary}

Reader's question: ${question}
${out ? `Answer in the language of the question; if that is unclear, in ${out}. Never put translated words in quotation marks.` : ""}

SOURCES (${sources.length}):

${sourceBlock}`;
  const { data, model } = await chatJson({
    system: ANSWER_SYSTEM,
    user,
    schema: ANSWER_SCHEMA,
    schemaName: "story_answer",
    maxTokens: 2500,
    timeoutMs: 55000,
    retries: 1,
    deadlineAt,
  });
  return { data, model };
}
