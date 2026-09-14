// Server-side helpers for the notebook API: validation schemas, DTOs, the
// per-user settings (seeded with the suggested subjects), the derived fields
// kept on each document and the tab-tree rules. Server only: it imports the
// models. The rest of src/lib/notebook is shared with the browser.

import { z } from "zod";
import NotebookFolder from "@/models/NotebookFolder";
import NotebookSettings from "@/models/NotebookSettings";
import { jsonError } from "@/utils/apiValidation";
import {
  SUGGESTED_SUBJECTS,
  SUBJECT_NAME_MAX,
  SUBJECTS_PER_NOTE,
  subjectKey,
  colorForSubject,
} from "./subjects";
import {
  htmlToText,
  countWords,
  extractWikiLinks,
  previewOf,
} from "./text";
import { orderedTabs, tabLevel, tabSubtreeHeight, MAX_TAB_LEVELS } from "./tree";

export const SIGN_IN = { signInMessage: "Sign in to use the notebook." };

export const LIMITS = {
  tabs: 60,
  content: 200000,
  title: 200,
  tabTitle: 120,
  folderName: 120,
  links: 200,
};

/* ── validation ────────────────────────────────────────── */

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const subjectName = z.string().trim().min(1).max(SUBJECT_NAME_MAX);
export const subjectList = z
  .array(subjectName)
  .max(SUBJECTS_PER_NOTE)
  .transform((names) => {
    const seen = new Set();
    return names.filter((name) => {
      const key = subjectKey(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

/** Throwable error that `run()` turns into a JSON response. */
export function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Runs a route body, mapping apiError() to its status and anything else to 500. */
export async function run(label, fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.status && error.status < 500) return jsonError(error.status, error.message);
    console.error(`[notebook] ${label} failed`, error);
    return jsonError(500, "Something went wrong in the notebook.");
  }
}

/* ── DTOs ──────────────────────────────────────────────── */

export function folderDto(folder) {
  return {
    id: String(folder._id),
    name: folder.name,
    parent: folder.parent ? String(folder.parent) : null,
    order: folder.order ?? 0,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export function tabDto(tab, { withContent = true } = {}) {
  return {
    id: String(tab._id),
    title: tab.title,
    parent: tab.parent || null,
    order: tab.order ?? 0,
    ...(withContent ? { content: tab.content || "" } : {}),
  };
}

export function docSummaryDto(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    folder: doc.folder ? String(doc.folder) : null,
    order: doc.order ?? 0,
    subjects: doc.subjects || [],
    pinned: !!doc.pinned,
    preview: doc.preview || "",
    wordCount: doc.wordCount || 0,
    links: doc.links || [],
    tabCount: doc.tabs?.length ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastOpenedAt: doc.lastOpenedAt || null,
  };
}

export function docDto(doc) {
  return {
    ...docSummaryDto(doc),
    tabs: orderedTabs(doc.tabs.map((t) => tabDto(t))).map(({ depth, ...tab }) => tab),
  };
}

export function settingsDto(settings) {
  return {
    subjects: (settings.subjects || []).map((s) => ({
      name: s.name,
      color: s.color,
      source: s.source || "custom",
    })),
    views: (settings.views || []).map((v) => ({
      id: String(v._id),
      name: v.name,
      layout: v.layout || "list",
      folder: v.folder ? String(v.folder) : null,
      subjects: v.subjects || [],
      sort: v.sort || "updated",
    })),
  };
}

/* ── settings ──────────────────────────────────────────── */

/** The user's settings, created with the suggested subjects on first use. */
export async function ensureSettings(userId) {
  const existing = await NotebookSettings.findOne({ user: userId });
  if (existing) return existing;
  const taken = [];
  const subjects = SUGGESTED_SUBJECTS.map((name) => {
    const color = colorForSubject(name, taken);
    taken.push(color);
    return { name, key: subjectKey(name), color, source: "suggested" };
  });
  try {
    return await NotebookSettings.create({ user: userId, subjects, views: [] });
  } catch (error) {
    // Two first requests raced; the unique index kept one of them.
    if (error?.code === 11000) return NotebookSettings.findOne({ user: userId });
    throw error;
  }
}

/* ── folders ───────────────────────────────────────────── */

/** Resolves a folder id (or null for the root) that must belong to the user. */
export async function assertFolder(userId, folderId) {
  if (!folderId) return null;
  const folder = await NotebookFolder.findOne({ _id: folderId, user: userId });
  if (!folder) throw apiError(400, "Folder not found");
  return folder;
}

/** The ids of `folderId` and every folder below it, for this user. */
export async function folderSubtree(userId, folderId) {
  const folders = await NotebookFolder.find({ user: userId }).select({ parent: 1 });
  const children = new Map();
  for (const f of folders) {
    const key = f.parent ? String(f.parent) : "root";
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(String(f._id));
  }
  const ids = new Set();
  const stack = [String(folderId)];
  while (stack.length) {
    const current = stack.pop();
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of children.get(current) || []) stack.push(child);
  }
  return ids;
}

/* ── documents ─────────────────────────────────────────── */

/** Recomputes preview, word count and [[links]] from the tab contents. */
export function deriveDocument(doc) {
  const tabs = orderedTabs(doc.tabs);
  const texts = tabs.map((t) => htmlToText(t.content));
  const all = texts.join("\n");
  doc.wordCount = countWords(all);
  doc.preview = previewOf(texts.find(Boolean) || "");
  doc.links = extractWikiLinks(all).slice(0, LIMITS.links);
}

/** Level a new subtab of `parentId` would sit at, or throws when too deep. */
export function assertTabParent(doc, parentId, { movingId = null } = {}) {
  if (!parentId) return null;
  const parent = doc.tabs.id(parentId);
  if (!parent) throw apiError(400, "Parent tab not found");
  if (movingId) {
    if (String(parentId) === String(movingId)) throw apiError(400, "A tab cannot be its own subtab");
    const chain = new Set();
    let current = parent;
    while (current) {
      chain.add(String(current._id));
      current = current.parent ? doc.tabs.id(current.parent) : null;
    }
    if (chain.has(String(movingId))) throw apiError(400, "A tab cannot be moved under one of its own subtabs");
  }
  const level = tabLevel(doc.tabs, parentId);
  const height = movingId ? tabSubtreeHeight(doc.tabs, movingId) : 1;
  if (level + height > MAX_TAB_LEVELS - 1) {
    throw apiError(400, `Tabs can only nest ${MAX_TAB_LEVELS} levels deep`);
  }
  return parent;
}

/** Renumbers the tabs under `parentId` 0..n-1, optionally placing `movedId` at `index`. */
export function renumberSiblings(doc, parentId, { movedId = null, index = null } = {}) {
  const wanted = parentId ? String(parentId) : null;
  const siblings = doc.tabs
    .filter((t) => (t.parent || null) === wanted)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (movedId != null && index != null) {
    const from = siblings.findIndex((t) => String(t._id) === String(movedId));
    if (from >= 0) {
      const [moved] = siblings.splice(from, 1);
      siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, moved);
    }
  }
  siblings.forEach((tab, i) => {
    tab.order = i;
  });
}
