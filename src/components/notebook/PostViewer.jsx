"use client";

// Full-screen viewer for a saved post: the image or video large, its note
// and link beside it, and arrow keys to move through the collection.

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiUrl, openExternal } from "@/lib/platform";
import { platformLabel, formatBytes, formatDuration } from "@/lib/notebook/posts";
import {
  ActionButton,
  IconChevronRight,
  IconEdit,
  IconExternal,
  IconPin,
  IconTrash,
  IconX,
  formatDate,
} from "@/components/notebook/notebookUi";

export default function PostViewer({ post, hasPrev, hasNext, onPrev, onNext, onClose, onEdit, onDelete, onTogglePin }) {
  useEffect(() => {
    if (!post) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [post, hasPrev, hasNext, onPrev, onNext, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {post ? (
        <motion.div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <header className="flex items-center gap-2 px-4 py-3 text-white/90 shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{post.title || "Untitled post"}</p>
              <p className="text-[11px] text-white/60 truncate">
                {platformLabel(post.platform)} · {formatDate(post.createdAt)}
                {post.size ? ` · ${formatBytes(post.size)}` : ""}
                {post.duration ? ` · ${formatDuration(post.duration)}` : ""}
                {post.width ? ` · ${post.width}×${post.height}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTogglePin(post)}
              title={post.pinned ? "Unpin" : "Pin to top"}
              aria-label={post.pinned ? "Unpin" : "Pin to top"}
              className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${post.pinned ? "text-accent" : "text-white/80"}`}
            >
              <IconPin className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(post)}
              title="Edit details"
              aria-label="Edit details"
              className="p-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            >
              <IconEdit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(post)}
              title="Delete post"
              aria-label="Delete post"
              className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-danger transition-colors"
            >
              <IconTrash className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            >
              <IconX className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 min-h-0 flex items-center gap-2 px-2 sm:px-4 pb-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              aria-label="Previous post"
              className="shrink-0 p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <IconChevronRight className="w-6 h-6 rotate-180" />
            </button>

            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="flex-1 min-w-0 h-full flex items-center justify-center"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {post.kind === "video" && post.url ? (
                // apiUrl(): the shells serve the page from the bundle, so a
                // relative media path has to point back at the API.
                <video
                  key={post.url}
                  src={apiUrl(post.url)}
                  poster={post.thumbUrl ? apiUrl(post.thumbUrl) : undefined}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-xl bg-black"
                />
              ) : post.kind === "image" && post.url ? (
                <img src={apiUrl(post.url)} alt={post.title || "Saved post"} className="max-h-full max-w-full rounded-xl object-contain" />
              ) : (
                <div className="max-w-md w-full rounded-2xl bg-surface border border-edge p-6 text-center space-y-3">
                  <p className="text-sm text-fg">{post.title || post.sourceUrl}</p>
                  {post.sourceUrl ? (
                    <ActionButton tone="primary" Icon={IconExternal} onClick={() => openExternal(post.sourceUrl)}>
                      Open the post
                    </ActionButton>
                  ) : null}
                </div>
              )}
            </motion.div>

            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next post"
              className="shrink-0 p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <IconChevronRight className="w-6 h-6" />
            </button>
          </div>

          {post.note || post.sourceUrl || post.tags?.length ? (
            <footer
              className="shrink-0 px-4 py-3 bg-black/40 text-white/85 space-y-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {post.note ? <p className="text-sm whitespace-pre-wrap max-w-3xl">{post.note}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {post.tags?.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-white/10 text-[11px]">
                    #{t}
                  </span>
                ))}
                {post.sourceUrl ? (
                  <button
                    type="button"
                    onClick={() => openExternal(post.sourceUrl)}
                    className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white underline underline-offset-2"
                  >
                    <IconExternal className="w-3.5 h-3.5" />
                    Original post
                  </button>
                ) : null}
              </div>
            </footer>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
