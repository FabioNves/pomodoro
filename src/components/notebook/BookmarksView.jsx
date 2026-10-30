"use client";

// Bookmarks: the posts saved on Instagram, brought in from the export
// Instagram makes under "Download your information". Drop the ZIP (or the
// saved_posts.html / .json inside it) anywhere on the view; the browser
// reads it and sends only the list of posts. Importing again adds what is
// new. Each card frames the media of Instagram's own embed, loaded as it
// scrolls into view. Loads its own data from /api/notebook/bookmarks.

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
  IconAlert,
  IconBookmark,
  IconExternal,
  IconMore,
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
} from "@/components/notebook/notebookUi";

const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";
const ACCEPT = ".zip,.html,.htm,.json,application/zip,text/html,application/json";
// Cards shown before "Show more": each one is an Instagram page once it
// scrolls into view, so a long collection is revealed in steps.
const PAGE = 36;

const KINDS = [
  { value: "all", label: "All" },
  { value: "reel", label: "Reels" },
  { value: "post", label: "Posts" },
];

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
        Drop the ZIP here as it is, or <code className="text-xs">saved_posts.html</code> from inside it. Posts already here are kept;
        new ones are added.
      </li>
    </ol>
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

function BookmarkCard({ bookmark, onOpen, menu }) {
  const open = () => onOpen(bookmark);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group relative rounded-xl border border-edge bg-surface overflow-hidden hover:border-edge-strong hover:shadow-md transition-all cursor-pointer flex flex-col"
    >
      <div className="relative">
        <EmbedPreview bookmark={bookmark} />
        {bookmark.kind === "reel" ? (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-medium">
            <IconPlay className="w-2.5 h-2.5" />
            Reel
          </span>
        ) : null}
        <PopoverMenu
          label={`Options for the post by ${bookmark.ownerUsername || "unknown"}`}
          items={menu}
          className={`${menuClass} absolute top-1.5 right-1.5 bg-surface/90 hover:bg-surface`}
        />
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
  const [lastImportAt, setLastImportAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState(null); // { name, done, total }
  const [dragging, setDragging] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);
  const mounted = useRef(true);
  // Held in a ref so a caller passing an inline function cannot make `load`
  // change on every render, which would reload the list forever.
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  useEffect(() => {
    mounted.current = true;
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

  /* ── import ────────────────────────────────────────── */

  const importFile = useCallback(
    async (file) => {
      if (importing) return;
      setImporting({ name: file.name, done: 0, total: 0 });
      try {
        const items = await readExport(file);
        let added = 0;
        setImporting({ name: file.name, done: 0, total: items.length });
        for (let i = 0; i < items.length; i += BOOKMARK_LIMITS.batch) {
          const batch = items.slice(i, i + BOOKMARK_LIMITS.batch);
          const data = await notebookApi("/api/notebook/bookmarks", { method: "POST", body: { items: batch } });
          added += data.added;
          if (mounted.current) setImporting({ name: file.name, done: i + batch.length, total: items.length });
        }
        toast.success(
          added
            ? `${added} new bookmark${added === 1 ? "" : "s"} imported.`
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
    },
    [importing, load],
  );

  const takeFiles = useCallback(
    (files) => {
      const list = [...files];
      if (!list.length) return;
      const file = list.find(isExportFile);
      if (!file) {
        toast.error("Drop the ZIP from Instagram, or saved_posts.html / saved_posts.json from inside it.");
        return;
      }
      importFile(file);
    },
    [importFile],
  );

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

  /* ── actions ───────────────────────────────────────── */

  const removeBookmark = async (bookmark) => {
    if (!window.confirm("Remove this bookmark? It stays saved on Instagram and will not come back with the next import.")) {
      return;
    }
    try {
      await notebookApi("/api/notebook/bookmarks", { method: "DELETE", body: { id: bookmark.id } });
      setBookmarks((prev) => {
        const next = prev.filter((b) => b.id !== bookmark.id);
        countRef.current?.(next.length);
        return next;
      });
      setViewingId((id) => (id === bookmark.id ? null : id));
    } catch (e) {
      toast.error(e.message || "Could not remove the bookmark.");
    }
  };

  const removeAll = async () => {
    if (!window.confirm("Delete every bookmark? Removed ones are forgotten too, so the next import brings everything back.")) {
      return;
    }
    try {
      await notebookApi("/api/notebook/bookmarks", { method: "DELETE", body: { all: true } });
      setBookmarks([]);
      setLastImportAt(null);
      countRef.current?.(0);
    } catch (e) {
      toast.error(e.message || "Could not delete the bookmarks.");
    }
  };

  /* ── derived ───────────────────────────────────────── */

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bookmarks.filter((b) => {
      if (kind !== "all" && b.kind !== kind) return false;
      if (!needle) return true;
      return (
        b.caption.toLowerCase().includes(needle) ||
        b.ownerUsername.toLowerCase().includes(needle) ||
        b.ownerName.toLowerCase().includes(needle)
      );
    });
  }, [bookmarks, search, kind]);

  useEffect(() => setShown(PAGE), [search, kind]);

  const index = viewingId ? visible.findIndex((b) => b.id === viewingId) : -1;
  const viewing = index >= 0 ? asPost(visible[index]) : null;

  const menuFor = (bookmark) => [
    { label: "Open on Instagram", Icon: IconExternal, onClick: () => openExternal(bookmark.url) },
    { divider: true },
    { label: "Remove bookmark", Icon: IconTrash, danger: true, onClick: () => removeBookmark(bookmark) },
  ];

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

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-edge flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg leading-tight">Bookmarks</h2>
            <p className="text-[11px] text-fg-subtle">
              {bookmarks.length} saved on Instagram
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
              </>
            ) : null}
            <ActionButton size="sm" tone="primary" Icon={IconUpload} onClick={pickFile} busy={!!importing}>
              Import export
            </ActionButton>
            {bookmarks.length ? (
              <PopoverMenu
                label="More bookmark options"
                trigger={
                  <span className="p-1.5 rounded-lg border border-edge text-fg-muted hover:text-fg hover:bg-surface-hover inline-flex">
                    <IconMore className="w-4 h-4" />
                  </span>
                }
                items={[
                  { label: "How to get the file", Icon: IconBookmark, onClick: () => setHelpOpen(true) },
                  { divider: true },
                  { label: "Delete all bookmarks", Icon: IconTrash, danger: true, onClick: removeAll },
                ]}
              />
            ) : null}
          </div>
        </div>

        {importing ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-soft text-primary text-xs">
            <Spinner className="w-3.5 h-3.5" />
            <span className="truncate">
              {importing.total
                ? `Importing ${importing.done} of ${importing.total} posts…`
                : `Reading ${importing.name}…`}
            </span>
          </div>
        ) : null}
      </div>

      {/* Gallery */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin]">
        {visible.length ? (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.slice(0, shown).map((b) => (
                <BookmarkCard key={b.id} bookmark={b} onOpen={(x) => setViewingId(x.id)} menu={menuFor(b)} />
              ))}
            </div>
            {visible.length > shown ? (
              <div className="flex justify-center pt-4">
                <ActionButton size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({visible.length - shown} left)
                </ActionButton>
              </div>
            ) : null}
          </>
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
        hasNext={index >= 0 && index < visible.length - 1}
        onPrev={() => index > 0 && setViewingId(visible[index - 1].id)}
        onNext={() => index >= 0 && index < visible.length - 1 && setViewingId(visible[index + 1].id)}
        onClose={() => setViewingId(null)}
        onDelete={() => removeBookmark(visible[index])}
        deleteLabel="Remove bookmark"
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
