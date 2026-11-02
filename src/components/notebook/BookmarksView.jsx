"use client";

// Bookmarks: the posts saved on Instagram, brought in from the export
// Instagram makes under "Download your information". Drop the ZIP (or the
// saved_posts.html / .json inside it) anywhere on the view; the browser
// reads it, asks which folder it goes in (one per account, usually) and
// sends only the list of posts. Importing again adds what is new. Folders
// collapse; selection mode moves or removes many bookmarks at once. Each
// card frames the media of Instagram's own embed, loaded as it scrolls
// into view. Loads its own data from /api/notebook/bookmarks.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { openExternal } from "@/lib/platform";
import { notebookApi } from "@/lib/notebook/client";
import { isExportFile, readExport } from "@/lib/notebook/bookmarkImport";
import {
  BOOKMARK_LIMITS,
  EMBED_HEADER,
  EMBED_MEDIA_RATIO,
  EMBED_WIDTH,
  instagramEmbedUrl,
} from "@/lib/notebook/bookmarks";
import PostViewer from "@/components/notebook/PostViewer";
import {
  ActionButton,
  EmptyState,
  Field,
  IconAlert,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconExternal,
  IconFolder,
  IconFolderPlus,
  IconMore,
  IconMove,
  IconPlay,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
  Modal,
  PopoverMenu,
  Segmented,
  Spinner,
  formatDate,
  inputClass,
} from "@/components/notebook/notebookUi";

const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";
const ACCEPT = ".zip,.html,.htm,.json,application/zip,text/html,application/json";
// Cards shown per folder before "Show more": each one is an Instagram page
// once it scrolls into view, so a long folder is revealed in steps.
const PAGE = 24;
// The section of bookmarks in no folder.
const UNFILED = "unfiled";
// Which folders are collapsed is a device preference.
const COLLAPSED_KEY = "pomodrive.bookmarks.collapsed";

const KINDS = [
  { value: "all", label: "All" },
  { value: "reel", label: "Reels" },
  { value: "post", label: "Posts" },
];

function readCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

/** Runs `send` over `ids` in pieces the API accepts. */
async function inChunks(ids, send) {
  for (let i = 0; i < ids.length; i += BOOKMARK_LIMITS.ids) {
    await send(ids.slice(i, i + BOOKMARK_LIMITS.ids));
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ── how to get the file ───────────────────────────────── */

function ExportSteps() {
  return (
    <ol className="list-decimal pl-5 space-y-1.5 text-sm text-fg-muted text-left">
      <li>
        In Instagram open <b className="text-fg">Accounts Center → Your information and permissions → Download your information</b>.
      </li>
      <li>
        Choose <b className="text-fg">Some of your information</b>, tick only <b className="text-fg">Saved</b>, and pick{" "}
        <b className="text-fg">HTML</b> or <b className="text-fg">JSON</b> with the date range you want.
      </li>
      <li>When Instagram emails you that it is ready, download the ZIP.</li>
      <li>
        Drop the ZIP here as it is, or <code className="text-xs">saved_posts.html</code> from inside it, and pick the folder it goes in.
        Posts already here are kept; new ones are added.
      </li>
    </ol>
  );
}

/* ── dialogs ───────────────────────────────────────────── */

function FolderNameDialog({ open, title, initial = "", confirmLabel, onClose, onSave }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await onSave(name.trim());
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" Icon={IconCheck} onClick={submit} busy={busy} disabled={!name.trim()}>
            {confirmLabel}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="Folder name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={BOOKMARK_LIMITS.folderName}
            placeholder="e.g. the account name"
            className={inputClass}
          />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * Asks where an export goes once it has been read: a new folder (named
 * after the account when the export says), an existing one, or none.
 */
function ImportDialog({ draft, folders, onClose, onImport }) {
  const [target, setTarget] = useState("new");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!draft) return;
    const suggested = draft.account || `Instagram ${new Date().toLocaleString(undefined, { month: "short", year: "numeric" })}`;
    // An account imported before goes back into its folder.
    const existing = folders.find((f) => f.name.trim().toLowerCase() === suggested.toLowerCase());
    setTarget(existing ? existing.id : "new");
    setName(suggested);
  }, [draft, folders]);

  const submit = (e) => {
    e?.preventDefault();
    if (target === "new" && !name.trim()) return;
    onImport(target === "new" ? { name: name.trim() } : target === "none" ? null : { id: target });
  };

  return (
    <Modal
      open={!!draft}
      title={draft ? `Import ${plural(draft.items.length, "saved post")}` : ""}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" Icon={IconUpload} onClick={submit} disabled={target === "new" && !name.trim()}>
            Import
          </ActionButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {draft?.account ? (
          <p className="text-sm text-fg-muted">
            From the account <b className="text-fg">@{draft.account}</b>.
          </p>
        ) : null}
        <Field label="Folder" hint="Posts already in another folder stay where they are.">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
            <option value="new">New folder…</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="none">No folder</option>
          </select>
        </Field>
        {target === "new" ? (
          <Field label="New folder name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={BOOKMARK_LIMITS.folderName}
              className={inputClass}
            />
          </Field>
        ) : null}
      </form>
    </Modal>
  );
}

/* ── a card ────────────────────────────────────────────── */

/**
 * The media of a post, from Instagram's embed page: the page is drawn at
 * EMBED_WIDTH, shifted up past its header and scaled to the card, so only
 * the picture shows. It loads once the card comes near the screen and
 * takes no clicks: the card opens the full player.
 */
function EmbedPreview({ bookmark }) {
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const sizer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / EMBED_WIDTH));
    sizer.observe(box);
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          watcher.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    watcher.observe(box);
    return () => {
      sizer.disconnect();
      watcher.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} className="relative bg-surface-2 overflow-hidden" style={{ aspectRatio: String(EMBED_MEDIA_RATIO) }}>
      {loaded ? null : (
        <div className="absolute inset-0 flex items-center justify-center">
          {near ? <Spinner className="w-5 h-5 text-fg-subtle" /> : <IconBookmark className="w-6 h-6 text-fg-subtle" />}
        </div>
      )}
      {near && scale ? (
        <iframe
          src={instagramEmbedUrl(bookmark)}
          title={`Instagram ${bookmark.kind} by ${bookmark.ownerUsername || "unknown"}`}
          tabIndex={-1}
          aria-hidden="true"
          loading="lazy"
          scrolling="no"
          onLoad={() => setLoaded(true)}
          className={`absolute left-0 top-0 border-0 pointer-events-none bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{
            width: EMBED_WIDTH,
            height: EMBED_HEADER + EMBED_WIDTH / EMBED_MEDIA_RATIO + 4,
            transformOrigin: "0 0",
            transform: `scale(${scale}) translateY(-${EMBED_HEADER}px)`,
          }}
        />
      ) : null}
    </div>
  );
}

/** A square tick box drawn as a span, for spots already inside a button. */
function Tick({ state, className = "" }) {
  return (
    <span
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
        state === "none" ? "border-fg-subtle bg-surface/90" : "border-primary bg-primary text-primary-fg"
      } ${className}`}
    >
      {state === "all" ? <IconCheck className="w-3 h-3" /> : state === "some" ? <span className="w-2 h-0.5 rounded bg-current" /> : null}
    </span>
  );
}

function BookmarkCard({ bookmark, selecting, selected, onActivate, menu }) {
  return (
    <div
      role={selecting ? "checkbox" : "button"}
      aria-checked={selecting ? selected : undefined}
      tabIndex={0}
      onClick={(e) => onActivate(bookmark, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(bookmark, e);
        }
      }}
      className={`group relative rounded-xl border bg-surface overflow-hidden transition-all cursor-pointer flex flex-col select-none ${
        selected ? "border-primary ring-2 ring-primary/50" : "border-edge hover:border-edge-strong hover:shadow-md"
      }`}
    >
      <div className="relative">
        <EmbedPreview bookmark={bookmark} />
        {bookmark.kind === "reel" ? (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-medium">
            <IconPlay className="w-2.5 h-2.5" />
            Reel
          </span>
        ) : null}
        {selecting ? (
          <>
            {/* Covers the preview so the whole card reads as one tick box. */}
            <span className={`absolute inset-0 transition-colors ${selected ? "bg-primary/15" : ""}`} />
            <Tick state={selected ? "all" : "none"} className="absolute top-1.5 left-1.5" />
          </>
        ) : (
          <PopoverMenu
            label={`Options for the post by ${bookmark.ownerUsername || "unknown"}`}
            items={menu}
            className={`${menuClass} absolute top-1.5 right-1.5 bg-surface/90 hover:bg-surface`}
          />
        )}
      </div>
      <div className="p-2.5 space-y-1 flex-1">
        <p className="text-xs font-semibold text-fg truncate" title={bookmark.ownerName || undefined}>
          {bookmark.ownerUsername ? `@${bookmark.ownerUsername}` : bookmark.ownerName || "Instagram"}
        </p>
        {bookmark.caption ? <p className="text-[11px] leading-snug text-fg-muted line-clamp-2">{bookmark.caption}</p> : null}
        {bookmark.savedAt ? <p className="text-[10px] text-fg-subtle">Saved {formatDate(bookmark.savedAt)}</p> : null}
      </div>
    </div>
  );
}

/* ── a folder ──────────────────────────────────────────── */

function FolderSection({
  section,
  filtering,
  collapsed,
  onToggle,
  selecting,
  selection,
  onSelectSection,
  shown,
  onShowMore,
  menu,
  renderCard,
}) {
  const { label, total, visible } = section;
  const picked = visible.filter((b) => selection.has(b.id)).length;
  const tick = !picked ? "none" : picked === visible.length ? "all" : "some";

  return (
    <section className="rounded-2xl border border-edge bg-surface-2/30">
      <div className="group flex items-center gap-2 pl-2 pr-2 py-1.5">
        {selecting && visible.length ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={tick === "all" ? true : tick === "some" ? "mixed" : false}
            aria-label={`Select every bookmark in ${label}`}
            onClick={() => onSelectSection(section, tick !== "all")}
            className="p-1 rounded-md hover:bg-surface-hover"
          >
            <Tick state={tick} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1 rounded-lg text-left hover:bg-surface-hover transition-colors"
        >
          <IconChevronDown className={`w-4 h-4 shrink-0 text-fg-subtle transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          {section.folder ? <IconFolder className="w-4 h-4 shrink-0 text-primary" /> : <IconBookmark className="w-4 h-4 shrink-0 text-fg-subtle" />}
          <span className="text-sm font-semibold text-fg truncate">{label}</span>
          <span className="text-[11px] tabular-nums text-fg-subtle shrink-0">
            {filtering ? `${visible.length} of ${total}` : total}
            {selecting && picked ? ` · ${picked} selected` : ""}
          </span>
        </button>
        {menu.length ? <PopoverMenu label={`Options for ${label}`} items={menu} className={menuClass} /> : null}
      </div>

      {collapsed ? null : (
        <div className="px-3 pb-3">
          {visible.length ? (
            <>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visible.slice(0, shown).map(renderCard)}
              </div>
              {visible.length > shown ? (
                <div className="flex justify-center pt-3">
                  <ActionButton size="sm" onClick={onShowMore}>
                    Show more ({visible.length - shown} left)
                  </ActionButton>
                </div>
              ) : null}
            </>
          ) : (
            <p className="px-1 py-2 text-xs text-fg-subtle">
              {total ? "Nothing here matches the filters." : "No bookmarks in this folder. Move some here in selection mode."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ── the view ──────────────────────────────────────────── */

/** A bookmark in the shape PostViewer shows: a link post that plays inline. */
function asPost(bookmark) {
  return {
    id: bookmark.id,
    kind: "link",
    platform: "instagram",
    sourceUrl: bookmark.url,
    title: bookmark.ownerUsername ? `@${bookmark.ownerUsername}` : bookmark.ownerName || "Instagram post",
    note: bookmark.caption,
    createdAt: bookmark.savedAt || bookmark.importedAt,
    tags: [],
  };
}

export default function BookmarksView({ onCountChange }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [lastImportAt, setLastImportAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [shown, setShown] = useState({}); // section key -> cards shown
  const [importDraft, setImportDraft] = useState(null); // { name, items, account }
  const [importing, setImporting] = useState(null); // { name, done, total }
  const [dragging, setDragging] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(null); // { folder? , then? }
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState(() => new Set());
  const anchorRef = useRef(null);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);
  const mounted = useRef(true);
  // Held in a ref so a caller passing an inline function cannot make `load`
  // change on every render, which would reload the list forever.
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  useEffect(() => {
    mounted.current = true;
    setCollapsed(readCollapsed());
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await notebookApi("/api/notebook/bookmarks");
      if (!mounted.current) return;
      setBookmarks(data.bookmarks);
      setFolders(data.folders || []);
      setLastImportAt(data.lastImportAt);
      countRef.current?.(data.bookmarks.length);
    } catch (e) {
      if (mounted.current) setError(e.message || "Could not load your bookmarks.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setCollapsedSaved = useCallback((update) => {
    setCollapsed((prev) => {
      const next = update(new Set(prev));
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // Private mode: the folders just open again next time.
      }
      return next;
    });
  }, []);

  const expand = useCallback(
    (key) =>
      setCollapsedSaved((s) => {
        s.delete(key);
        return s;
      }),
    [setCollapsedSaved],
  );

  /* ── folders ───────────────────────────────────────── */

  const createFolder = async (name) => {
    const data = await notebookApi("/api/notebook/bookmarks/folders", { method: "POST", body: { name } });
    setFolders((prev) => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
    return data.folder;
  };

  const renameFolder = async (folder, name) => {
    try {
      const data = await notebookApi("/api/notebook/bookmarks/folders", { method: "PATCH", body: { id: folder.id, name } });
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? data.folder : f)).sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch (e) {
      toast.error(e.message || "Could not rename the folder.");
      return false;
    }
  };

  const deleteFolder = async (folder, mode, count) => {
    const question =
      mode === "delete"
        ? `Delete “${folder.name}” and its ${plural(count, "bookmark")}? Importing that account again brings them back.`
        : `Delete the folder “${folder.name}”? Its ${plural(count, "bookmark")} stay, in no folder.`;
    if (!window.confirm(question)) return;
    try {
      await notebookApi("/api/notebook/bookmarks/folders", { method: "DELETE", body: { id: folder.id, bookmarks: mode } });
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setBookmarks((prev) => {
        const next =
          mode === "delete"
            ? prev.filter((b) => b.folder !== folder.id)
            : prev.map((b) => (b.folder === folder.id ? { ...b, folder: null } : b));
        countRef.current?.(next.length);
        return next;
      });
      if (mode === "delete") toast.success(`Deleted ${plural(count, "bookmark")}.`);
    } catch (e) {
      toast.error(e.message || "Could not delete the folder.");
    }
  };

  /* ── import ────────────────────────────────────────── */

  const takeFiles = useCallback(
    async (files) => {
      const file = [...files].find(isExportFile);
      if (!files.length || importing) return;
      if (!file) {
        toast.error("Drop the ZIP from Instagram, or saved_posts.html / saved_posts.json from inside it.");
        return;
      }
      setImporting({ name: file.name, done: 0, total: 0 });
      try {
        const { items, account } = await readExport(file);
        if (mounted.current) setImportDraft({ name: file.name, items, account });
      } catch (e) {
        toast.error(e.message || "Could not read that file.");
      } finally {
        if (mounted.current) setImporting(null);
      }
    },
    [importing],
  );

  const runImport = async (target) => {
    const { name, items } = importDraft;
    setImportDraft(null);
    setImporting({ name, done: 0, total: items.length });
    try {
      const folder = target?.name ? await createFolder(target.name) : target?.id ? folders.find((f) => f.id === target.id) : null;
      let added = 0;
      for (let i = 0; i < items.length; i += BOOKMARK_LIMITS.batch) {
        const batch = items.slice(i, i + BOOKMARK_LIMITS.batch);
        const data = await notebookApi("/api/notebook/bookmarks", {
          method: "POST",
          body: { folder: folder?.id || null, items: batch },
        });
        added += data.added;
        if (mounted.current) setImporting({ name, done: i + batch.length, total: items.length });
      }
      expand(folder?.id || UNFILED);
      toast.success(
        added
          ? `${plural(added, "new bookmark")} imported${folder ? ` into ${folder.name}` : ""}.`
          : `Nothing new: all ${items.length} posts were already here.`,
      );
      await load({ quiet: true });
    } catch (e) {
      toast.error(e.message || "Could not import that file.");
      // Some batches may have landed before the failure.
      load({ quiet: true });
    } finally {
      if (mounted.current) setImporting(null);
    }
  };

  // The whole window accepts the drop while this view is open, so a drop on
  // the header counts too and a stray one never opens the file in the tab.
  useEffect(() => {
    const carriesFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onDragEnter = (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e) => {
      if (!carriesFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    };
    const onDrop = (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      takeFiles(e.dataTransfer.files || []);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      dragDepth.current = 0;
    };
  }, [takeFiles]);

  /* ── derived ───────────────────────────────────────── */

  const needle = search.trim().toLowerCase();
  const filtering = Boolean(needle) || kind !== "all";

  const sections = useMemo(() => {
    const matches = (b) =>
      (kind === "all" || b.kind === kind) &&
      (!needle ||
        b.caption.toLowerCase().includes(needle) ||
        b.ownerUsername.toLowerCase().includes(needle) ||
        b.ownerName.toLowerCase().includes(needle));
    const known = new Set(folders.map((f) => f.id));
    const byKey = new Map([...folders.map((f) => [f.id, []]), [UNFILED, []]]);
    for (const b of bookmarks) byKey.get(b.folder && known.has(b.folder) ? b.folder : UNFILED).push(b);
    const list = folders.map((f) => ({ key: f.id, folder: f, label: f.name, items: byKey.get(f.id) }));
    if (byKey.get(UNFILED).length) list.push({ key: UNFILED, folder: null, label: "No folder", items: byKey.get(UNFILED) });
    return list
      .map((s) => ({ ...s, total: s.items.length, visible: s.items.filter(matches) }))
      .filter((s) => !filtering || s.visible.length);
  }, [bookmarks, folders, kind, needle, filtering]);

  // Reading order of what is on screen: the viewer steps through it and a
  // shift-click selects a stretch of it.
  const ordered = useMemo(
    () => sections.filter((s) => !collapsed.has(s.key)).flatMap((s) => s.visible.slice(0, shown[s.key] || PAGE)),
    [sections, collapsed, shown],
  );
  const allVisible = useMemo(() => sections.flatMap((s) => s.visible), [sections]);

  useEffect(() => setShown({}), [search, kind]);

  // Forget selected bookmarks that are gone (removed, filtered out).
  useEffect(() => {
    setSelection((prev) => {
      const present = new Set(allVisible.map((b) => b.id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allVisible]);

  const index = viewingId ? ordered.findIndex((b) => b.id === viewingId) : -1;
  const viewing = index >= 0 ? asPost(ordered[index]) : null;

  /* ── selection ─────────────────────────────────────── */

  const startSelecting = (ids = []) => {
    setSelecting(true);
    setViewingId(null);
    setSelection(new Set(ids));
    anchorRef.current = null;
  };

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelection(new Set());
    anchorRef.current = null;
  }, []);

  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[role='dialog']")) return;
      stopSelecting();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, stopSelecting]);

  const activate = (bookmark, e) => {
    if (!selecting) {
      setViewingId(bookmark.id);
      return;
    }
    const from = anchorRef.current ? ordered.findIndex((b) => b.id === anchorRef.current) : -1;
    const to = ordered.findIndex((b) => b.id === bookmark.id);
    setSelection((prev) => {
      const next = new Set(prev);
      const on = !prev.has(bookmark.id);
      // Shift-click sets the whole stretch since the last click the same way.
      const range = e?.shiftKey && from >= 0 && to >= 0 ? ordered.slice(Math.min(from, to), Math.max(from, to) + 1) : [bookmark];
      for (const b of range) {
        if (on) next.add(b.id);
        else next.delete(b.id);
      }
      return next;
    });
    anchorRef.current = bookmark.id;
  };

  const selectSection = (section, on) =>
    setSelection((prev) => {
      const next = new Set(prev);
      for (const b of section.visible) {
        if (on) next.add(b.id);
        else next.delete(b.id);
      }
      return next;
    });

  const allSelected = allVisible.length > 0 && selection.size === allVisible.length;

  /* ── actions on bookmarks ──────────────────────────── */

  const moveTo = async (ids, folder) => {
    if (!ids.length) return;
    const target = folder?.id || null;
    const before = bookmarks;
    setBookmarks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, folder: target } : b)));
    expand(target || UNFILED);
    try {
      await inChunks(ids, (chunk) =>
        notebookApi("/api/notebook/bookmarks", { method: "PATCH", body: { ids: chunk, folder: target } }),
      );
      toast.success(`Moved ${plural(ids.length, "bookmark")} to ${folder ? folder.name : "No folder"}.`);
      stopSelecting();
    } catch (e) {
      setBookmarks(before);
      toast.error(e.message || "Could not move the bookmarks.");
      load({ quiet: true });
    }
  };

  const remove = async (ids) => {
    if (!ids.length) return;
    const question =
      ids.length === 1
        ? "Remove this bookmark? It stays saved on Instagram and will not come back with the next import."
        : `Remove ${plural(ids.length, "bookmark")}? They stay saved on Instagram and will not come back with the next import.`;
    if (!window.confirm(question)) return;
    try {
      await inChunks(ids, (chunk) => notebookApi("/api/notebook/bookmarks", { method: "DELETE", body: { ids: chunk } }));
      const gone = new Set(ids);
      setBookmarks((prev) => {
        const next = prev.filter((b) => !gone.has(b.id));
        countRef.current?.(next.length);
        return next;
      });
      setViewingId((id) => (gone.has(id) ? null : id));
      if (ids.length > 1) {
        toast.success(`Removed ${plural(ids.length, "bookmark")}.`);
        stopSelecting();
      }
    } catch (e) {
      toast.error(e.message || "Could not remove the bookmarks.");
    }
  };

  const removeAll = async () => {
    if (!window.confirm("Delete every bookmark and folder? Removed ones are forgotten too, so the next import brings everything back.")) {
      return;
    }
    try {
      await notebookApi("/api/notebook/bookmarks", { method: "DELETE", body: { all: true } });
      setBookmarks([]);
      setFolders([]);
      setLastImportAt(null);
      stopSelecting();
      countRef.current?.(0);
    } catch (e) {
      toast.error(e.message || "Could not delete the bookmarks.");
    }
  };

  /** "Move to" choices for a set of bookmarks, ending with a new folder. */
  const moveMenu = (ids) => [
    ...folders.map((f) => ({ label: f.name, Icon: IconFolder, onClick: () => moveTo(ids, f) })),
    { label: "No folder", Icon: IconBookmark, onClick: () => moveTo(ids, null) },
    { divider: true },
    { label: "New folder…", Icon: IconFolderPlus, onClick: () => setFolderDialog({ then: (folder) => moveTo(ids, folder) }) },
  ];

  const cardMenu = (bookmark) => [
    { label: "Open on Instagram", Icon: IconExternal, onClick: () => openExternal(bookmark.url) },
    { label: "Select", Icon: IconCheck, onClick: () => startSelecting([bookmark.id]) },
    { divider: true },
    { label: "Remove bookmark", Icon: IconTrash, danger: true, onClick: () => remove([bookmark.id]) },
  ];

  const sectionMenu = (section) => {
    const select = { label: "Select all in folder", Icon: IconCheck, onClick: () => startSelecting(section.visible.map((b) => b.id)) };
    if (!section.folder) return section.visible.length ? [select] : [];
    return [
      { label: "Rename", Icon: IconEdit, onClick: () => setFolderDialog({ folder: section.folder }) },
      section.visible.length ? select : null,
      { divider: true },
      section.total
        ? { label: "Delete folder, keep bookmarks", Icon: IconFolder, onClick: () => deleteFolder(section.folder, "keep", section.total) }
        : null,
      {
        label: section.total ? `Delete folder and its ${plural(section.total, "bookmark")}` : "Delete folder",
        Icon: IconTrash,
        danger: true,
        onClick: () => deleteFolder(section.folder, "delete", section.total),
      },
    ].filter(Boolean);
  };

  /* ── render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-fg-muted">
        <Spinner className="w-4 h-4" />
        Loading your bookmarks…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/40 bg-danger-soft text-danger text-sm max-w-md">
          <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <ActionButton size="sm" onClick={() => load()}>
            Retry
          </ActionButton>
        </div>
      </div>
    );
  }

  const pickFile = () => inputRef.current?.click();
  const selectedIds = [...selection];
  const hasAny = bookmarks.length > 0 || folders.length > 0;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-edge flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg leading-tight">Bookmarks</h2>
            <p className="text-[11px] text-fg-subtle">
              {bookmarks.length} saved on Instagram
              {folders.length ? ` · ${plural(folders.length, "folder")}` : ""}
              {lastImportAt ? ` · last import ${formatDate(lastImportAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {bookmarks.length ? (
              <>
                <label className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bookmarks…"
                    aria-label="Search bookmarks"
                    className="w-36 sm:w-48 pl-8 pr-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus [&::-webkit-search-cancel-button]:appearance-none"
                  />
                </label>
                <Segmented label="Show" value={kind} onChange={setKind} options={KINDS} />
                <ActionButton
                  size="sm"
                  tone={selecting ? "primary" : "outline"}
                  Icon={IconCheck}
                  onClick={() => (selecting ? stopSelecting() : startSelecting())}
                >
                  {selecting ? "Done" : "Select"}
                </ActionButton>
              </>
            ) : null}
            <ActionButton size="sm" tone="primary" Icon={IconUpload} onClick={pickFile} busy={!!importing}>
              Import export
            </ActionButton>
            {hasAny ? (
              <PopoverMenu
                label="More bookmark options"
                trigger={
                  <span className="p-1.5 rounded-lg border border-edge text-fg-muted hover:text-fg hover:bg-surface-hover inline-flex">
                    <IconMore className="w-4 h-4" />
                  </span>
                }
                items={[
                  { label: "New folder", Icon: IconFolderPlus, onClick: () => setFolderDialog({}) },
                  { label: "Collapse all folders", Icon: IconChevronDown, onClick: () => setCollapsedSaved(() => new Set(sections.map((s) => s.key))) },
                  { label: "Expand all folders", Icon: IconChevronDown, onClick: () => setCollapsedSaved(() => new Set()) },
                  { label: "How to get the file", Icon: IconBookmark, onClick: () => setHelpOpen(true) },
                  { divider: true },
                  { label: "Delete all bookmarks", Icon: IconTrash, danger: true, onClick: removeAll },
                ]}
              />
            ) : null}
          </div>
        </div>

        {selecting ? (
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-xl bg-primary-soft border border-primary/30">
            <button
              type="button"
              role="checkbox"
              aria-checked={allSelected ? true : selection.size ? "mixed" : false}
              aria-label={allSelected ? "Clear the selection" : "Select every bookmark shown"}
              onClick={() => setSelection(allSelected ? new Set() : new Set(allVisible.map((b) => b.id)))}
              className="p-1 rounded-md hover:bg-surface-hover"
            >
              <Tick state={allSelected ? "all" : selection.size ? "some" : "none"} />
            </button>
            <span className="text-xs font-semibold text-primary tabular-nums">
              {selection.size ? `${selection.size} selected` : "Tap bookmarks to select them"}
            </span>
            {!allSelected && allVisible.length ? (
              <button
                type="button"
                onClick={() => setSelection(new Set(allVisible.map((b) => b.id)))}
                className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Select all {allVisible.length}
              </button>
            ) : null}
            <span className="hidden sm:inline text-[11px] text-fg-subtle">Shift-click selects a range.</span>
            <div className="ml-auto flex items-center gap-1.5">
              {selection.size ? (
                <PopoverMenu
                  label="Move the selected bookmarks to a folder"
                  trigger={
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-edge bg-surface text-xs font-semibold text-fg hover:bg-surface-hover">
                      <IconMove className="w-3.5 h-3.5" />
                      Move to
                      <IconChevronDown className="w-3 h-3" />
                    </span>
                  }
                  items={moveMenu(selectedIds)}
                />
              ) : (
                <ActionButton size="sm" Icon={IconMove} disabled>
                  Move to
                </ActionButton>
              )}
              <ActionButton size="sm" tone="danger" Icon={IconTrash} disabled={!selection.size} onClick={() => remove(selectedIds)}>
                Remove
              </ActionButton>
              <button
                type="button"
                onClick={stopSelecting}
                aria-label="Leave selection mode"
                className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}

        {importing ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-soft text-primary text-xs">
            <Spinner className="w-3.5 h-3.5" />
            <span className="truncate">
              {importing.total ? `Importing ${importing.done} of ${importing.total} posts…` : `Reading ${importing.name}…`}
            </span>
          </div>
        ) : null}
      </div>

      {/* Folders */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin]">
        {sections.length ? (
          <div className="space-y-3">
            {sections.map((section) => (
              <FolderSection
                key={section.key}
                section={section}
                filtering={filtering}
                collapsed={collapsed.has(section.key)}
                onToggle={() =>
                  setCollapsedSaved((s) => {
                    if (s.has(section.key)) s.delete(section.key);
                    else s.add(section.key);
                    return s;
                  })
                }
                selecting={selecting}
                selection={selection}
                onSelectSection={selectSection}
                shown={shown[section.key] || PAGE}
                onShowMore={() => setShown((m) => ({ ...m, [section.key]: (m[section.key] || PAGE) + PAGE }))}
                menu={selecting ? [] : sectionMenu(section)}
                renderCard={(b) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    selecting={selecting}
                    selected={selection.has(b.id)}
                    onActivate={activate}
                    menu={cardMenu(b)}
                  />
                )}
              />
            ))}
          </div>
        ) : bookmarks.length ? (
          <EmptyState
            Icon={IconSearch}
            title="Nothing matches"
            hint={search ? `No bookmark matches “${search}”.` : "None of that kind yet."}
            action={
              <ActionButton
                size="sm"
                Icon={IconX}
                onClick={() => {
                  setSearch("");
                  setKind("all");
                }}
              >
                Clear filters
              </ActionButton>
            }
          />
        ) : (
          <div className="max-w-lg mx-auto">
            <EmptyState
              Icon={IconBookmark}
              title="Bring in your Instagram bookmarks"
              hint="Instagram does not share saved posts with other apps, but it lets you download them. Drop that download anywhere on this view."
              action={
                <ActionButton size="sm" tone="primary" Icon={IconUpload} onClick={pickFile} busy={!!importing}>
                  Choose the file
                </ActionButton>
              }
            />
            <div className="rounded-2xl border border-edge bg-surface p-4">
              <ExportSteps />
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          takeFiles(e.target.files || []);
          e.target.value = "";
        }}
      />

      {/* Drop overlay */}
      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-primary bg-primary-soft/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none"
          >
            <IconUpload className="w-8 h-8 text-primary" />
            <p className="text-sm font-semibold text-primary">Drop your Instagram export</p>
            <p className="text-xs text-primary/80">The ZIP, or saved_posts.html / .json from inside it.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PostViewer
        post={viewing}
        hasPrev={index > 0}
        hasNext={index >= 0 && index < ordered.length - 1}
        onPrev={() => index > 0 && setViewingId(ordered[index - 1].id)}
        onNext={() => index >= 0 && index < ordered.length - 1 && setViewingId(ordered[index + 1].id)}
        onClose={() => setViewingId(null)}
        onDelete={() => remove([ordered[index].id])}
        deleteLabel="Remove bookmark"
      />

      <ImportDialog draft={importDraft} folders={folders} onClose={() => setImportDraft(null)} onImport={runImport} />

      <FolderNameDialog
        open={!!folderDialog}
        title={folderDialog?.folder ? "Rename folder" : "New folder"}
        initial={folderDialog?.folder?.name || ""}
        confirmLabel={folderDialog?.folder ? "Rename" : "Create"}
        onClose={() => setFolderDialog(null)}
        onSave={async (name) => {
          if (folderDialog?.folder) return renameFolder(folderDialog.folder, name);
          try {
            const folder = await createFolder(name);
            await folderDialog?.then?.(folder);
            return true;
          } catch (e) {
            toast.error(e.message || "Could not create the folder.");
            return false;
          }
        }}
      />

      <Modal
        open={helpOpen}
        title="Get your saved posts from Instagram"
        onClose={() => setHelpOpen(false)}
        footer={<ActionButton onClick={() => setHelpOpen(false)}>Close</ActionButton>}
      >
        <ExportSteps />
      </Modal>
    </div>
  );
}
