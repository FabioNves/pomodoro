"use client";

// Saved posts: a collection of the images and videos someone keeps from
// Instagram, TikTok, Facebook and the rest. Drop files anywhere on the view
// (or paste, or pick them), and each one uploads in the background and
// appears in the grid. Loads its own data from /api/notebook/posts.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { apiUrl, openExternal } from "@/lib/platform";
import { notebookApi } from "@/lib/notebook/client";
import { uploadPost } from "@/lib/notebook/postUpload";
import { filesFromDataTransfer, urlFromDataTransfer } from "@/lib/notebook/media";
import {
  PLATFORMS,
  POST_LIMITS,
  detectPlatform,
  platformLabel,
  formatBytes,
  formatDuration,
  mediaKindOf,
  mediaTypeOf,
} from "@/lib/notebook/posts";
import PostViewer from "@/components/notebook/PostViewer";
import {
  ActionButton,
  EmptyState,
  Field,
  IconAlert,
  IconCheck,
  IconEdit,
  IconExternal,
  IconGrid,
  IconLink,
  IconList,
  IconPin,
  IconPlay,
  IconPlus,
  IconPosts,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
  Modal,
  PopoverMenu,
  Segmented,
  Spinner,
  inputClass,
  relativeTime,
} from "@/components/notebook/notebookUi";

const menuClass = "opacity-0 group-hover:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100";
const ACCEPT = "image/*,video/*";

/* ── add-a-link / edit dialog ──────────────────────────── */

function PostEditor({ open, post, draft = null, title, onClose, onSave }) {
  const [fields, setFields] = useState({ title: "", note: "", sourceUrl: "", platform: "other", tags: "" });
  const [busy, setBusy] = useState(false);
  const [touchedPlatform, setTouchedPlatform] = useState(false);

  useEffect(() => {
    if (!open) return;
    // A draft carries the link a user dropped or pasted in.
    const source = post || draft || {};
    setTouchedPlatform(!!post);
    setFields({
      title: source.title || "",
      note: source.note || "",
      sourceUrl: source.sourceUrl || "",
      platform: source.platform || (source.sourceUrl ? detectPlatform(source.sourceUrl) : "other"),
      tags: (source.tags || []).join(", "),
    });
  }, [open, post, draft]);

  const set = (patch) => setFields((f) => ({ ...f, ...patch }));

  const onUrl = (value) => {
    // The platform follows the link until the user picks one themselves.
    set({ sourceUrl: value, ...(touchedPlatform ? {} : { platform: value ? detectPlatform(value) : "other" }) });
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!post && !fields.sourceUrl.trim()) return;
    setBusy(true);
    const ok = await onSave({
      title: fields.title.trim(),
      note: fields.note.trim(),
      sourceUrl: fields.sourceUrl.trim(),
      platform: fields.platform,
      tags: fields.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, POST_LIMITS.tags),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            tone="primary"
            Icon={IconCheck}
            onClick={submit}
            busy={busy}
            disabled={!post && !fields.sourceUrl.trim()}
          >
            {post ? "Save" : "Save post"}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {post ? null : (
          <Field label="Link to the post" hint="Paste the link from Instagram, TikTok, YouTube…">
            <input
              autoFocus
              value={fields.sourceUrl}
              onChange={(e) => onUrl(e.target.value)}
              maxLength={POST_LIMITS.sourceUrl}
              placeholder="https://www.instagram.com/p/…"
              className={inputClass}
            />
          </Field>
        )}
        <Field label="Title">
          <input
            value={fields.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={POST_LIMITS.title}
            placeholder="What is it?"
            className={inputClass}
          />
        </Field>
        <Field label="Note (optional)" hint="Why you kept it.">
          <textarea
            value={fields.note}
            onChange={(e) => set({ note: e.target.value })}
            maxLength={POST_LIMITS.note}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform">
            <select
              value={fields.platform}
              onChange={(e) => {
                setTouchedPlatform(true);
                set({ platform: e.target.value });
              }}
              className={inputClass}
            >
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags" hint="Comma separated.">
            <input
              value={fields.tags}
              onChange={(e) => set({ tags: e.target.value })}
              placeholder="reels, workout"
              className={inputClass}
            />
          </Field>
        </div>
        {post ? (
          <Field label="Link (optional)">
            <input
              value={fields.sourceUrl}
              onChange={(e) => onUrl(e.target.value)}
              maxLength={POST_LIMITS.sourceUrl}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        ) : null}
      </form>
    </Modal>
  );
}

/* ── pieces ────────────────────────────────────────────── */

function UploadTile({ job, onCancel }) {
  return (
    <div className="relative rounded-xl border border-edge bg-surface-2/60 overflow-hidden flex flex-col">
      <div className="aspect-square flex flex-col items-center justify-center gap-2 p-3 text-center">
        {job.error ? (
          <>
            <IconAlert className="w-6 h-6 text-danger" />
            <p className="text-[11px] text-danger line-clamp-3">{job.error}</p>
          </>
        ) : (
          <>
            <Spinner className="w-6 h-6 text-primary" />
            <p className="text-[11px] text-fg-muted truncate max-w-full">{job.name}</p>
            <p className="text-[11px] tabular-nums text-fg-subtle">{Math.round(job.progress * 100)}%</p>
          </>
        )}
      </div>
      {job.error ? null : (
        <div className="h-1 bg-surface-hover">
          <motion.div className="h-full bg-primary" animate={{ width: `${job.progress * 100}%` }} transition={{ duration: 0.2 }} />
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        aria-label={job.error ? "Dismiss" : "Cancel upload"}
        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-surface/90 text-fg-subtle hover:text-danger transition-colors"
      >
        <IconX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PostTile({ post, ctx, layout }) {
  // apiUrl(): inside the mobile and desktop shells the page is served from
  // the bundle, so a relative media path has to point back at the API.
  const raw = post.thumbUrl || (post.kind === "image" ? post.url : null);
  const thumb = raw ? apiUrl(raw) : null;
  const open = () => ctx.onOpen(post);

  if (layout === "list") {
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
        className="group flex items-center gap-3 p-2 rounded-xl border border-edge bg-surface hover:border-edge-strong transition-colors cursor-pointer"
      >
        <div className="w-16 h-16 shrink-0 rounded-lg bg-surface-2 overflow-hidden flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <IconLink className="w-5 h-5 text-fg-subtle" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg truncate">{post.title || "Untitled post"}</p>
          <p className="text-[11px] text-fg-subtle truncate">
            {platformLabel(post.platform)} · {relativeTime(post.createdAt)}
            {post.duration ? ` · ${formatDuration(post.duration)}` : ""}
            {post.size ? ` · ${formatBytes(post.size)}` : ""}
          </p>
          {post.note ? <p className="text-[11px] text-fg-muted truncate">{post.note}</p> : null}
        </div>
        {post.pinned ? <IconPin className="w-3.5 h-3.5 text-accent shrink-0" /> : null}
        <PopoverMenu label={`Options for ${post.title || "this post"}`} items={ctx.menu(post)} className={menuClass} />
      </div>
    );
  }

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
      <div className="relative aspect-square bg-surface-2 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconLink className="w-7 h-7 text-fg-subtle" />
          </div>
        )}
        {post.kind === "video" ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm">
              <IconPlay className="w-4 h-4 ml-0.5" />
            </span>
          </span>
        ) : null}
        {post.duration ? (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] tabular-nums">
            {formatDuration(post.duration)}
          </span>
        ) : null}
        {post.pinned ? (
          <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-surface/90 text-accent">
            <IconPin className="w-3 h-3" />
          </span>
        ) : null}
        <PopoverMenu
          label={`Options for ${post.title || "this post"}`}
          items={ctx.menu(post)}
          className={`${menuClass} absolute top-1.5 right-1.5 bg-surface/90 hover:bg-surface`}
        />
      </div>
      <div className="p-2.5 space-y-0.5">
        <p className="text-xs font-medium text-fg truncate">{post.title || "Untitled post"}</p>
        <p className="text-[10px] text-fg-subtle truncate">
          {platformLabel(post.platform)} · {relativeTime(post.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* ── the view ──────────────────────────────────────────── */

let jobSeq = 0;

export default function PostsView({ onCountChange }) {
  const [posts, setPosts] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [layout, setLayout] = useState("grid");
  const [jobs, setJobs] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null); // post to edit, or {} for a link
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notebookApi("/api/notebook/posts");
      if (!mounted.current) return;
      setPosts(data.posts);
      setStorage(data.storage);
      countRef.current?.(data.posts.length);
    } catch (e) {
      if (mounted.current) setError(e.message || "Could not load your posts.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addPost = useCallback(
    (post) => {
      setPosts((prev) => {
        const next = [post, ...prev.filter((p) => p.id !== post.id)];
        next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));
        countRef.current?.(next.length);
        return next;
      });
    },
    [],
  );

  /* ── uploads ───────────────────────────────────────── */

  const patchJob = (id, patch) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const startUpload = useCallback(
    (file) => {
      const kind = mediaKindOf(mediaTypeOf(file));
      if (!kind) {
        toast.error(`${file.name || "That file"} is not an image or a video.`);
        return;
      }
      const id = `job-${(jobSeq += 1)}`;
      const controller = new AbortController();
      setJobs((prev) => [...prev, { id, name: file.name || "file", progress: 0, error: null, controller }]);
      uploadPost(file, {
        onProgress: (p) => mounted.current && patchJob(id, { progress: p }),
        signal: controller.signal,
      })
        .then(({ post, storage: used }) => {
          if (!mounted.current) return;
          addPost(post);
          if (used) setStorage(used);
          setJobs((prev) => prev.filter((j) => j.id !== id));
        })
        .catch((e) => {
          if (!mounted.current) return;
          if (controller.signal.aborted) {
            setJobs((prev) => prev.filter((j) => j.id !== id));
          } else {
            patchJob(id, { error: e.message || "Upload failed" });
          }
          // Whatever went wrong, the bytes must not keep occupying the quota.
          notebookApi("/api/notebook/posts")
            .then((data) => mounted.current && setStorage(data.storage))
            .catch(() => {});
        });
    },
    [addPost],
  );

  const addFiles = useCallback(
    (files) => {
      const list = [...files];
      if (!list.length) return;
      list.slice(0, 25).forEach(startUpload);
      if (list.length > 25) toast.error("25 files at a time, please.");
    },
    [startUpload],
  );

  const cancelJob = (job) => {
    job.controller?.abort();
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  };

  /* ── drag, drop and paste ──────────────────────────── */

  // The whole window accepts the drop while this view is open: dropping on
  // the header is the same as dropping on the grid, and a stray drop can no
  // longer make the browser navigate away to the file.
  useEffect(() => {
    const carriesFiles = (e) =>
      [...(e.dataTransfer?.types || [])].some((t) => t === "Files" || t === "text/uri-list");

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
      const files = filesFromDataTransfer(e.dataTransfer);
      if (files.length) {
        addFiles(files);
        return;
      }
      const url = urlFromDataTransfer(e.dataTransfer);
      if (url) setEditing({ draft: { sourceUrl: url } });
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
  }, [addFiles]);

  useEffect(() => {
    const onPaste = (e) => {
      const target = e.target;
      if (target?.closest?.("input, textarea, [contenteditable='true']")) return;
      // A dialog is open: the paste belongs to it, not to the grid behind it.
      if (document.querySelector("[role='dialog']")) return;
      const files = filesFromDataTransfer(e.clipboardData).filter((f) => mediaKindOf(mediaTypeOf(f)));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
        return;
      }
      const url = urlFromDataTransfer(e.clipboardData);
      if (url) {
        e.preventDefault();
        setEditing({ draft: { sourceUrl: url } });
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  /* ── post actions ──────────────────────────────────── */

  const savePost = async (fields) => {
    const post = editing?.id ? editing : null;
    try {
      if (post) {
        const data = await notebookApi("/api/notebook/posts", { method: "PATCH", body: { id: post.id, ...fields } });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
        setViewing((v) => (v && v.id === post.id ? data.post : v));
      } else {
        const data = await notebookApi("/api/notebook/posts", { method: "POST", body: fields });
        addPost(data.post);
      }
      return true;
    } catch (e) {
      toast.error(e.message || "Could not save the post.");
      return false;
    }
  };

  const togglePin = async (post) => {
    const pinned = !post.pinned;
    setPosts((prev) =>
      prev
        .map((p) => (p.id === post.id ? { ...p, pinned } : p))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt)),
    );
    setViewing((v) => (v && v.id === post.id ? { ...v, pinned } : v));
    try {
      await notebookApi("/api/notebook/posts", { method: "PATCH", body: { id: post.id, pinned } });
    } catch (e) {
      setPosts((prev) =>
        prev
          .map((p) => (p.id === post.id ? { ...p, pinned: post.pinned } : p))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt)),
      );
      setViewing((v) => (v && v.id === post.id ? { ...v, pinned: post.pinned } : v));
      toast.error(e.message || "Could not update the post.");
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm(`Delete “${post.title || "this post"}”? The file is removed too.`)) return;
    try {
      const data = await notebookApi("/api/notebook/posts", { method: "DELETE", body: { id: post.id } });
      setPosts((prev) => {
        const next = prev.filter((p) => p.id !== post.id);
        countRef.current?.(next.length);
        return next;
      });
      if (data.storage) setStorage(data.storage);
      setViewing((v) => (v && v.id === post.id ? null : v));
    } catch (e) {
      toast.error(e.message || "Could not delete the post.");
    }
  };

  /* ── derived ───────────────────────────────────────── */

  const platformsPresent = useMemo(() => {
    const counts = new Map();
    for (const p of posts) counts.set(p.platform, (counts.get(p.platform) || 0) + 1);
    return PLATFORMS.filter((p) => counts.has(p.key)).map((p) => ({ ...p, count: counts.get(p.key) }));
  }, [posts]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (platform !== "all" && p.platform !== platform) return false;
      if (!needle) return true;
      return (
        (p.title || "").toLowerCase().includes(needle) ||
        (p.note || "").toLowerCase().includes(needle) ||
        (p.tags || []).some((t) => t.includes(needle))
      );
    });
  }, [posts, search, platform]);

  const index = viewing ? visible.findIndex((p) => p.id === viewing.id) : -1;

  const ctx = {
    onOpen: setViewing,
    menu: (post) => [
      { label: post.pinned ? "Unpin" : "Pin to top", Icon: IconPin, onClick: () => togglePin(post) },
      { label: "Edit details", Icon: IconEdit, onClick: () => setEditing(post) },
      post.sourceUrl ? { label: "Open the original", Icon: IconExternal, onClick: () => openExternal(post.sourceUrl) } : null,
      { divider: true },
      { label: "Delete post", Icon: IconTrash, danger: true, onClick: () => deletePost(post) },
    ].filter(Boolean),
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-fg-muted">
        <Spinner className="w-4 h-4" />
        Loading your posts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/40 bg-danger-soft text-danger text-sm max-w-md">
          <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <ActionButton size="sm" onClick={load}>
            Retry
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-edge flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg leading-tight">Saved posts</h2>
            <p className="text-[11px] text-fg-subtle">
              {posts.length} post{posts.length === 1 ? "" : "s"}
              {storage ? ` · ${formatBytes(storage.used)} of ${formatBytes(storage.quota)} used` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts…"
                aria-label="Search posts"
                className="w-36 sm:w-48 pl-8 pr-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus [&::-webkit-search-cancel-button]:appearance-none"
              />
            </label>
            <ActionButton size="sm" Icon={IconLink} onClick={() => setEditing({ draft: {} })}>
              Add a link
            </ActionButton>
            <ActionButton size="sm" tone="primary" Icon={IconUpload} onClick={() => inputRef.current?.click()}>
              Add files
            </ActionButton>
            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "grid", label: "Grid", Icon: IconGrid },
                { value: "list", label: "List", Icon: IconList },
              ]}
            />
          </div>
        </div>

        {platformsPresent.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlatform("all")}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                platform === "all" ? "bg-primary-soft border-primary/40 text-primary" : "bg-surface-2 border-edge text-fg-muted hover:text-fg"
              }`}
            >
              All
            </button>
            {platformsPresent.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(platform === p.key ? "all" : p.key)}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                  platform === p.key ? "bg-primary-soft border-primary/40 text-primary" : "bg-surface-2 border-edge text-fg-muted hover:text-fg"
                }`}
              >
                {p.label}
                <span className="ml-1 text-[10px] tabular-nums text-fg-subtle">{p.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin]">
        {jobs.length || visible.length ? (
          <div
            className={
              layout === "grid"
                ? "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "space-y-2"
            }
          >
            {jobs.map((job) =>
              layout === "grid" ? (
                <UploadTile key={job.id} job={job} onCancel={() => cancelJob(job)} />
              ) : (
                <div key={job.id} className="flex items-center gap-3 p-2 rounded-xl border border-edge bg-surface-2/60">
                  {job.error ? <IconAlert className="w-5 h-5 text-danger" /> : <Spinner className="w-5 h-5 text-primary" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{job.name}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {job.error || `Uploading… ${Math.round(job.progress * 100)}%`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelJob(job)}
                    aria-label="Cancel upload"
                    className="p-1 rounded-md text-fg-subtle hover:text-danger"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>
              ),
            )}
            {visible.map((post) => (
              <PostTile key={post.id} post={post} ctx={ctx} layout={layout} />
            ))}
          </div>
        ) : posts.length ? (
          <EmptyState
            Icon={IconSearch}
            title="Nothing matches"
            hint={search ? `No post matches “${search}”.` : "No posts from that platform yet."}
            action={
              <ActionButton
                size="sm"
                Icon={IconX}
                onClick={() => {
                  setSearch("");
                  setPlatform("all");
                }}
              >
                Clear filters
              </ActionButton>
            }
          />
        ) : (
          <EmptyState
            Icon={IconPosts}
            title="No saved posts yet"
            hint="Drag an image or a video anywhere on this view, paste one, or add a link to the original post."
            action={
              <div className="flex items-center gap-2">
                <ActionButton size="sm" tone="primary" Icon={IconUpload} onClick={() => inputRef.current?.click()}>
                  Choose files
                </ActionButton>
                <ActionButton size="sm" Icon={IconPlus} onClick={() => setEditing({ draft: {} })}>
                  Add a link
                </ActionButton>
              </div>
            }
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files || []);
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
            <p className="text-sm font-semibold text-primary">Drop to save</p>
            <p className="text-xs text-primary/80">Images and videos are stored; a link is saved as a post.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PostViewer
        post={viewing}
        hasPrev={index > 0}
        hasNext={index >= 0 && index < visible.length - 1}
        onPrev={() => index > 0 && setViewing(visible[index - 1])}
        onNext={() => index >= 0 && index < visible.length - 1 && setViewing(visible[index + 1])}
        onClose={() => setViewing(null)}
        onEdit={(post) => setEditing(post)}
        onDelete={deletePost}
        onTogglePin={togglePin}
      />

      <PostEditor
        key={editing?.id || editing?.draft?.sourceUrl || "new"}
        open={!!editing}
        post={editing?.id ? editing : null}
        draft={editing?.draft || null}
        title={editing?.id ? "Edit post" : "Save a post by link"}
        onClose={() => setEditing(null)}
        onSave={savePost}
      />
    </div>
  );
}
