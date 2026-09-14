// AI suggestions for project structure (milestones and tasks). Server only.
//
// Everything returned here is a suggestion: the browser shows it in a review
// screen where the user selects, edits and reorders before anything is
// created, so this module only has to produce clean, bounded lists.

import { chatJson, AiError, isOpenAiConfigured } from "@/lib/ai/openai";

export { AiError, isOpenAiConfigured };

export const LIMITS = {
  milestones: 12,
  tasksPerMilestone: 12,
  nameLength: 80,
  titleLength: 200,
  descriptionLength: 300,
};

const MILESTONE_ITEM = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short milestone name (2-5 words)." },
    description: {
      type: "string",
      description: "One sentence: what being done with this milestone means.",
    },
  },
  required: ["name", "description"],
  additionalProperties: false,
};

const TASK_ITEM = {
  type: "object",
  properties: {
    title: { type: "string", description: "Actionable task title starting with a verb." },
  },
  required: ["title"],
  additionalProperties: false,
};

const MILESTONES_SCHEMA = {
  type: "object",
  properties: {
    milestones: { type: "array", items: MILESTONE_ITEM },
  },
  required: ["milestones"],
  additionalProperties: false,
};

const TASKS_SCHEMA = {
  type: "object",
  properties: {
    tasks: { type: "array", items: TASK_ITEM },
  },
  required: ["tasks"],
  additionalProperties: false,
};

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: MILESTONE_ITEM.properties.name,
          description: MILESTONE_ITEM.properties.description,
          tasks: { type: "array", items: TASK_ITEM },
        },
        required: ["name", "description", "tasks"],
        additionalProperties: false,
      },
    },
  },
  required: ["milestones"],
  additionalProperties: false,
};

const PLANNER_SYSTEM = `You help people break a personal or work project into milestones and tasks for a planner app.

Rules:
- Milestones are phases or outcomes in chronological order, 4 to 8 of them unless the goal is tiny. Names are short (2-5 words, no numbering, no trailing punctuation). Each description is one plain sentence.
- Tasks are concrete, finishable actions that start with a verb ("Write the outline", "Book the venue"). 3 to 7 per milestone. No sub-bullets, no explanations inside the title.
- Match the language of the user's description.
- Never repeat milestones or tasks the user already has; complement them.
- Do not invent details about the user; stay generic where the description is vague.`;

const clean = (s, max) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function dedupe(list, keyOf) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = keyOf(item).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function projectBlock({ projectName, description, goal }) {
  const lines = [`Project: ${clean(projectName, 120) || "(untitled)"}`];
  if (description) lines.push(`Project description: ${clean(description, 800)}`);
  if (goal) lines.push(`What the user wants to accomplish: ${clean(goal, 1200)}`);
  return lines.join("\n");
}

function listBlock(label, items) {
  const list = (items || []).map((s) => clean(s, 120)).filter(Boolean);
  if (!list.length) return "";
  return `${label}:\n${list.map((s) => `- ${s}`).join("\n")}`;
}

export function normaliseMilestones(list) {
  return dedupe(
    (Array.isArray(list) ? list : [])
      .map((m) => ({
        name: clean(m?.name, LIMITS.nameLength),
        description: clean(m?.description, LIMITS.descriptionLength),
        tasks: normaliseTasks(m?.tasks),
      }))
      .filter((m) => m.name),
    (m) => m.name,
  ).slice(0, LIMITS.milestones);
}

export function normaliseTasks(list) {
  return dedupe(
    (Array.isArray(list) ? list : [])
      .map((t) => ({ title: clean(t?.title, LIMITS.titleLength) }))
      .filter((t) => t.title),
    (t) => t.title,
  ).slice(0, LIMITS.tasksPerMilestone);
}

/** Suggest milestones for a project (no tasks). */
export async function suggestMilestones({
  projectName,
  description,
  goal,
  existingMilestones = [],
}) {
  const user = [
    projectBlock({ projectName, description, goal }),
    listBlock("Milestones the project already has (do not repeat)", existingMilestones),
    "Suggest the milestones this project needs, in order.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const { data, model } = await chatJson({
    system: PLANNER_SYSTEM,
    user,
    schema: MILESTONES_SCHEMA,
    schemaName: "milestone_suggestions",
    maxTokens: 1500,
    timeoutMs: 45000,
  });
  return { milestones: normaliseMilestones(data.milestones), model };
}

/** Suggest tasks for one milestone. */
export async function suggestTasks({
  projectName,
  description,
  goal,
  milestone,
  otherMilestones = [],
  existingTasks = [],
}) {
  const user = [
    projectBlock({ projectName, description, goal }),
    listBlock("All milestones of the project, in order", otherMilestones),
    `Milestone to plan: ${clean(milestone?.name, LIMITS.nameLength)}${
      milestone?.description ? `\n${clean(milestone.description, LIMITS.descriptionLength)}` : ""
    }`,
    listBlock("Tasks this milestone already has (do not repeat)", existingTasks),
    "Suggest the tasks needed to complete this milestone, in a sensible order. Stay inside this milestone; do not cover the other milestones.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const { data, model } = await chatJson({
    system: PLANNER_SYSTEM,
    user,
    schema: TASKS_SCHEMA,
    schemaName: "task_suggestions",
    maxTokens: 1200,
    timeoutMs: 45000,
  });
  return { tasks: normaliseTasks(data.tasks), model };
}

/** Suggest milestones with tasks for each (used when creating a project). */
export async function suggestStructure({ projectName, description, goal }) {
  const user = [
    projectBlock({ projectName, description, goal }),
    "Suggest the milestones for this project in order, and for each milestone the tasks needed to complete it.",
  ].join("\n\n");
  const { data, model } = await chatJson({
    system: PLANNER_SYSTEM,
    user,
    schema: STRUCTURE_SCHEMA,
    schemaName: "structure_suggestions",
    maxTokens: 4000,
    timeoutMs: 75000,
  });
  return { milestones: normaliseMilestones(data.milestones), model };
}
