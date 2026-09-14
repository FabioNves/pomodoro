// Tree helpers shared by the notebook API and the browser: folder nesting,
// the tab tree inside a document, note sorting/filtering and [[link]]
// resolution. Everything works on plain objects (DTOs or Mongoose docs).

const ROOT = "root";

const idOf = (value) => (value == null ? null : String(value._id ?? value.id ?? value));

/* ── folders ───────────────────────────────────────────── */

export function buildFolderIndex(folders) {
  const byId = new Map();
  const children = new Map();
  for (const folder of folders) byId.set(idOf(folder), folder);
  for (const folder of folders) {
    const key = folder.parent ? String(folder.parent) : ROOT;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(folder);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  }
  return { byId, children };
}

export function folderChildren(index, parentId) {
  return index.children.get(parentId ? String(parentId) : ROOT) || [];
}

/** Folders from the root down to `id` (empty for the root). */
export function folderPath(index, id) {
  const path = [];
  let current = id ? index.byId.get(String(id)) : null;
  let guard = 0;
  while (current && guard++ < 100) {
    path.unshift(current);
    current = current.parent ? index.byId.get(String(current.parent)) : null;
  }
  return path;
}

/** `id` and every folder below it. */
export function folderSubtreeIds(index, id) {
  const ids = new Set();
  const stack = [String(id)];
  while (stack.length) {
    const current = stack.pop();
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of folderChildren(index, current)) stack.push(idOf(child));
  }
  return ids;
}

export function folderPathLabel(index, id, separator = " / ") {
  return folderPath(index, id)
    .map((f) => f.name)
    .join(separator);
}

/* ── tabs ──────────────────────────────────────────────── */

export const MAX_TAB_LEVELS = 3;

const tabParent = (tab) => (tab.parent ? String(tab.parent) : null);

export function tabChildren(tabs, parentId) {
  const wanted = parentId ? String(parentId) : null;
  return tabs
    .filter((t) => tabParent(t) === wanted)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Depth-first order, each tab annotated with its `depth` (0 for top level). */
export function orderedTabs(tabs) {
  const out = [];
  const visit = (parentId, depth, seen) => {
    for (const tab of tabChildren(tabs, parentId)) {
      const id = idOf(tab);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...(typeof tab.toObject === "function" ? tab.toObject() : tab), id, depth });
      if (depth + 1 < MAX_TAB_LEVELS + 2) visit(id, depth + 1, seen);
    }
  };
  visit(null, 0, new Set());
  // Tabs whose parent no longer exists still show up, at the top level.
  const known = new Set(out.map((t) => t.id));
  for (const tab of tabs) {
    const id = idOf(tab);
    if (!known.has(id)) out.push({ ...(typeof tab.toObject === "function" ? tab.toObject() : tab), id, depth: 0 });
  }
  return out;
}

/** 0-based level of a tab (0 = top level). */
export function tabLevel(tabs, id) {
  const byId = new Map(tabs.map((t) => [idOf(t), t]));
  let level = 0;
  let current = byId.get(String(id));
  let guard = 0;
  while (current && tabParent(current) && guard++ < 50) {
    level += 1;
    current = byId.get(tabParent(current));
  }
  return level;
}

/** `id` and every tab below it. */
export function tabSubtreeIds(tabs, id) {
  const ids = new Set();
  const stack = [String(id)];
  while (stack.length) {
    const current = stack.pop();
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of tabChildren(tabs, current)) stack.push(idOf(child));
  }
  return ids;
}

/** Height of the subtree rooted at `id` (1 for a tab without subtabs). */
export function tabSubtreeHeight(tabs, id) {
  const children = tabChildren(tabs, id);
  if (!children.length) return 1;
  return 1 + Math.max(...children.map((c) => tabSubtreeHeight(tabs, idOf(c))));
}

/* ── notes ─────────────────────────────────────────────── */

export const SORTS = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title" },
];

export function sortDocs(docs, sort = "updated") {
  const time = (v) => (v ? new Date(v).getTime() : 0);
  return [...docs].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (sort === "title") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (sort === "created") return time(b.createdAt) - time(a.createdAt);
    return time(b.updatedAt) - time(a.updatedAt);
  });
}

export function docMatchesQuery(doc, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return (
    doc.title.toLowerCase().includes(q) ||
    (doc.preview || "").toLowerCase().includes(q) ||
    (doc.subjects || []).some((s) => s.toLowerCase().includes(q))
  );
}

/**
 * Resolve every document's [[links]] to document ids.
 * Returns outgoing links, backlinks and the titles that match no note.
 */
export function buildLinkIndex(docs) {
  const byTitle = new Map();
  for (const doc of docs) {
    const key = doc.title.trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, doc.id);
  }
  const outgoing = new Map();
  const backlinks = new Map();
  const unresolved = new Map();
  for (const doc of docs) {
    const targets = [];
    const missing = [];
    for (const title of doc.links || []) {
      const target = byTitle.get(title.trim().toLowerCase());
      if (target && target !== doc.id) {
        if (!targets.includes(target)) targets.push(target);
      } else if (!target) {
        missing.push(title);
      }
    }
    outgoing.set(doc.id, targets);
    if (missing.length) unresolved.set(doc.id, missing);
    for (const target of targets) {
      if (!backlinks.has(target)) backlinks.set(target, []);
      backlinks.get(target).push(doc.id);
    }
  }
  return { outgoing, backlinks, unresolved };
}
