// Strict JSON schemas for every model call. OpenAI's strict mode needs every
// property listed in `required` and additionalProperties:false on each
// object, which is why nothing here is optional.
//
// The model never emits URLs, publishers or dates: stories reference the
// retrieved material by numeric `sourceIds`, and the validator resolves
// those back to stored articles.

const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });
const int = (description) => ({ type: "integer", description });
const arr = (items, description) => ({ type: "array", items, description });
const obj = (properties, description) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description ? { description } : {}),
});

export const QUERY_PLAN_SCHEMA = obj({
  queries: arr(
    obj({
      query: str("A concrete search query, 3-10 words, as a news reader would type it."),
      topic: str("The user topic this query serves, verbatim from the list, or 'broad' for general important news."),
      purpose: { type: "string", enum: ["topic", "broad"] },
    }),
    "Search queries to run, most important first.",
  ),
});

const STORY = obj({
  sourceIds: arr(int("Id of a retrieved item (the number in [brackets])."), "Every retrieved item this story is built from. At least one; list the primary source first."),
  headline: str("A neutral headline in your own words, max 15 words."),
  summary: str("What happened, from the sources only."),
  whyItMatters: str("Why the reader should care, tied to their interests when relevant."),
  isAnalysis: bool("True when whyItMatters is your interpretation rather than something a source states."),
  topics: arr(str("A user topic this story matches, verbatim from the topic list."), "User topics this story matches; empty for stories outside their topics."),
  suggestedTopics: arr(
    str("A short topic name (1-4 words) named in the sources: a company, product, technology, person or field."),
    "Up to two topics the reader could follow to get more stories like this one. Never repeat a topic the reader already follows. Empty if nothing fits.",
  ),
});

const GROUPED = obj({
  title: str("Short title, max 12 words."),
  summary: str("One to three sentences, sources only."),
  sourceIds: arr(int("Id of a retrieved item."), "Retrieved items that support this. At least two for a trend."),
});

export const DAILY_BRIEFING_SCHEMA = obj({
  intro: str("One or two sentences opening the briefing. No greeting; the app adds it."),
  topStories: arr(STORY, "Most relevant stories for the user, best first."),
  worthKnowing: arr(STORY, "Important developments outside the user's topics. Empty if none or if not requested."),
  trends: arr(GROUPED, "Trends visible across several retrieved stories. Empty when the sources do not show one."),
  insufficientInformation: bool("True when the retrieved material is too thin or off-topic to write a useful briefing."),
  note: str("Shown to the reader when something needs saying (thin sources, conflicting reports). Empty otherwise."),
});

export const WEEKLY_BRIEFING_SCHEMA = obj({
  intro: str("One to three sentences framing the week. No greeting."),
  biggestDevelopments: arr(GROUPED, "The three to five developments that defined the week, each grouping related stories."),
  topStories: arr(STORY, "The most important individual stories for the user, best first."),
  trends: arr(GROUPED, "Trends across the week's retrieved stories."),
  missed: arr(STORY, "Quieter but relevant stories the user may have missed. Empty if none."),
  worthKnowing: arr(STORY, "Major developments outside the user's topics. Empty if none or if not requested."),
  insufficientInformation: bool("True when the retrieved material cannot support a weekly briefing."),
  note: str("Reader-facing note about gaps or disagreements between sources. Empty otherwise."),
});

export const FOLLOWUP_PLAN_SCHEMA = obj({
  needsSearch: bool("True when answering well needs information beyond the provided sources."),
  queries: arr(str("A search query."), "Up to three queries to run when needsSearch is true; empty otherwise."),
  recencyDays: int("How far back the searches should look, in days (1-365)."),
});

export const ANSWER_SCHEMA = obj({
  answer: str("The answer in plain prose. Cite sources inline as [n] using the ids given. Say clearly when the sources do not cover something."),
  citations: arr(int("Id of a source used."), "Every source id cited in the answer."),
  insufficient: bool("True when the sources do not contain enough to answer."),
});
