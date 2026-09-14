"use client";

// Rich-text editor for one tab: a contentEditable surface driven by the
// browser's editing commands, with a toolbar (paragraph styles, lists,
// checklists, colours, alignment, links, note links), keyboard shortcuts
// and paste sanitising. Content in and out is HTML; the parent sanitises it
// again before saving.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/notebook/sanitize";
import { IconChevronDown, IconLink, IconNote, IconPlus } from "@/components/notebook/notebookUi";

const icon = (path) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  };

const IconUndo = icon("M3 7v6h6M21 17a9 9 0 00-15-6.7L3 13");
const IconRedo = icon("M21 7v6h-6M3 17a9 9 0 0115-6.7L21 13");
const IconBold = icon("M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z");
const IconItalic = icon("M10 5h8M6 19h8M14 5l-4 14");
const IconUnderline = icon("M7 4v6a5 5 0 0010 0V4M5 20h14");
const IconStrike = icon("M5 12h14M16 7a4 4 0 00-7.6-1M8 16.5a4 4 0 007.4 1");
const IconUl = icon("M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01");
const IconOl = icon("M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M4 11.5a1.5 1.5 0 013 0c0 1.5-3 2-3 3.5h3M4 16h2.5a1 1 0 010 2H5h1.5a1 1 0 010 2H4");
const IconChecklist = icon("M10 6h10M10 12h10M10 18h10M3 6.5l1.5 1.5L7 5M3 12.5l1.5 1.5L7 11M3 18.5l1.5 1.5L7 17");
const IconAlignLeft = icon("M4 6h16M4 12h10M4 18h14");
const IconAlignCenter = icon("M4 6h16M7 12h10M5 18h14");
const IconAlignRight = icon("M4 6h16M10 12h10M6 18h14");
const IconIndent = icon("M3 6h18M10 12h11M10 18h11M3 10l4 2-4 2");
const IconOutdent = icon("M3 6h18M10 12h11M10 18h11M7 10l-4 2 4 2");
const IconRule = icon("M4 12h16");
const IconEraser = icon("M4 20h10M5.5 14.5l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8l-9 9H8.3a2 2 0 01-1.4-.6z");
const IconTextColor = icon("M5 20h14M8 16l4-11 4 11M9.5 12h5");
const IconHighlight = icon("M4 20h16M14 4l6 6-9 9H6v-5z");
const IconSize = icon("M4 18V7h10v11M4 12.5h10M17 18v-7h3");

const BLOCKS = [
  { value: "p", label: "Text" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "blockquote", label: "Quote" },
  { value: "pre", label: "Code block" },
];
const SIZES = [
  { value: "2", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "5", label: "Large" },
  { value: "6", label: "Huge" },
];
const TEXT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#111827"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e2e8f0"];
const BLOCK_SELECTOR = "p,h1,h2,h3,h4,div,blockquote,pre,li";
const POPOVER_WIDTH = 288;

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function ToolButton({ Icon, label, active = false, disabled = false, onClick, children, wide = false, ...rest }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-7 ${wide ? "px-2" : "min-w-7 px-1"} inline-flex items-center justify-center gap-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
        active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
      {...rest}
    >
      {Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

const Divider = () => <span className="w-px h-5 bg-edge mx-0.5 shrink-0" aria-hidden="true" />;

const menuItemClass = (active) =>
  `w-full px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors ${
    active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
  }`;

export default function RichTextEditor({ initialHtml, onChange, onSaveNow, placeholder = "Start writing…", noteTitles = [] }) {
  const wrapRef = useRef(null);
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const [fmt, setFmt] = useState({ block: "p" });
  const [empty, setEmpty] = useState(true);
  const [popover, setPopover] = useState(null); // { kind, left, top, trigger? }
  const [linkUrl, setLinkUrl] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [noteIndex, setNoteIndex] = useState(0);

  // Note-link picker options for the current query (typed after "[[" or in
  // the picker's own field): matching notes plus a "not created yet" entry.
  const query = noteQuery.trim();
  const noteMatches = noteTitles.filter((n) => !query || n.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const exactNote = noteTitles.find((n) => n.title.toLowerCase() === query.toLowerCase()) || null;
  const noteOptions = [...noteMatches, ...(query && !exactNote ? [{ id: "new", title: query, create: true }] : [])];

  const isInside = (node) => !!node && !!editorRef.current && editorRef.current.contains(node);
  const currentElement = () => {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!isInside(node)) return null;
    return node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  };

  // The "[[query" being typed before the caret (same text node), or null.
  const typedQuery = () => {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!sel?.isCollapsed || node?.nodeType !== Node.TEXT_NODE || !isInside(node)) return null;
    const before = node.textContent.slice(0, sel.anchorOffset);
    const at = before.lastIndexOf("[[");
    if (at < 0) return null;
    const text = before.slice(at + 2);
    if (text.includes("]]") || text.includes("\n") || text.length > 80) return null;
    return { query: text, node, start: at };
  };

  const updateEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!el.textContent.trim() && !el.querySelector("li, hr"));
  }, []);

  // Load the content once; the parent re-mounts this component per tab.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // An empty tab starts with one paragraph so the first line is wrapped
    // like every line the Enter key creates afterwards.
    el.innerHTML = sanitizeHtml(initialHtml || "") || "<p><br></p>";
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* not supported */
    }
    updateEmpty();
  }, []);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    updateEmpty();
    onChange?.(el.innerHTML);
  }, [onChange, updateEmpty]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && isInside(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = savedRange.current;
    const sel = window.getSelection();
    if (!range || !sel) return;
    sel.removeAllRanges();
    try {
      sel.addRange(range);
    } catch {
      /* the range no longer exists */
    }
  }, []);

  const refreshFormat = useCallback(() => {
    const el = currentElement();
    if (!el) return;
    const state = (command) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    let block = "p";
    try {
      block = String(document.queryCommandValue("formatBlock") || "p").toLowerCase();
    } catch {
      /* ignore */
    }
    if (el.closest("pre")) block = "pre";
    else if (el.closest("blockquote")) block = "blockquote";
    else if (!BLOCKS.some((b) => b.value === block)) block = "p";
    const li = el.closest("li");
    const list = li?.parentElement;
    const checklist = !!(list && list.tagName === "UL" && list.dataset.type === "checklist");
    setFmt({
      bold: state("bold"),
      italic: state("italic"),
      underline: state("underline"),
      strike: state("strikeThrough"),
      ul: !!(list && list.tagName === "UL" && !checklist),
      ol: !!(list && list.tagName === "OL"),
      check: checklist,
      center: state("justifyCenter"),
      right: state("justifyRight"),
      link: !!el.closest("a"),
      block,
    });
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !isInside(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      refreshFormat();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [refreshFormat]);

  // Popovers close on outside clicks and Escape.
  useEffect(() => {
    if (!popover) return undefined;
    const onDown = (e) => {
      if (wrapRef.current?.querySelector("[data-popover]")?.contains(e.target)) return;
      if (e.target.closest?.("[data-popover-trigger]")) return;
      setPopover(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPopover(null);
        restoreSelection();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover, restoreSelection]);

  /* ── commands ────────────────────────────────────────── */

  const exec = useCallback(
    (command, value = null, { css = false } = {}) => {
      restoreSelection();
      try {
        document.execCommand("styleWithCSS", false, css);
      } catch {
        /* ignore */
      }
      try {
        document.execCommand(command, false, value);
      } finally {
        try {
          document.execCommand("styleWithCSS", false, false);
        } catch {
          /* ignore */
        }
      }
      refreshFormat();
      emit();
    },
    [restoreSelection, refreshFormat, emit],
  );

  const placeFrom = (rect) => {
    const wrap = wrapRef.current.getBoundingClientRect();
    return {
      left: Math.max(8, Math.min(rect.left - wrap.left, wrap.width - POPOVER_WIDTH)),
      top: Math.max(44, rect.bottom - wrap.top + 4),
    };
  };

  const openPopover = (e, kind, extra = {}) => {
    saveSelection();
    const pos = placeFrom(e.currentTarget.getBoundingClientRect());
    setPopover((current) => (current?.kind === kind ? null : { kind, ...pos, ...extra }));
  };

  const openLink = (e) => {
    const anchor = currentElement()?.closest("a");
    setLinkUrl(anchor?.getAttribute("href") || "");
    if (e) {
      openPopover(e, "link");
      return;
    }
    saveSelection();
    setPopover({ kind: "link", left: 8, top: 44 });
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    setPopover(null);
    if (!url) {
      exec("unlink");
      return;
    }
    const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) exec("insertHTML", `<a href="${escapeHtml(href)}">${escapeHtml(url)}</a>&nbsp;`);
    else exec("createLink", href);
  };

  const setBlock = (value) => {
    setPopover(null);
    exec("formatBlock", `<${value}>`);
  };

  const toggleList = (kind) => {
    const list = currentElement()?.closest("li")?.parentElement;
    if (kind === "ul" && list?.tagName === "UL" && list.dataset.type === "checklist") {
      // Checklist -> plain bullets.
      list.removeAttribute("data-type");
      for (const li of list.querySelectorAll(":scope > li")) li.removeAttribute("data-checked");
      refreshFormat();
      emit();
      return;
    }
    exec(kind === "ul" ? "insertUnorderedList" : "insertOrderedList");
  };

  const toggleChecklist = () => {
    restoreSelection();
    const list = currentElement()?.closest("li")?.parentElement;
    if (list?.tagName === "UL" && list.dataset.type === "checklist") {
      exec("insertUnorderedList"); // removes the list
      return;
    }
    if (!list || list.tagName === "OL") document.execCommand("insertUnorderedList");
    const ul = currentElement()?.closest("ul");
    if (ul) {
      ul.dataset.type = "checklist";
      for (const li of ul.querySelectorAll(":scope > li")) if (!li.dataset.checked) li.dataset.checked = "false";
    }
    refreshFormat();
    emit();
  };

  // Lists indent natively; plain blocks get a margin step instead of the
  // browser's blockquote wrapping.
  const indent = (delta) => {
    restoreSelection();
    const el = currentElement();
    if (!el) return;
    if (el.closest("li")) {
      exec(delta > 0 ? "indent" : "outdent");
      return;
    }
    const block = el.closest(BLOCK_SELECTOR);
    const target = block && block !== editorRef.current && isInside(block) ? block : null;
    if (!target) {
      if (delta > 0) exec("insertText", "    ");
      return;
    }
    const current = parseInt(target.style.marginLeft || "0", 10) || 0;
    const next = Math.max(0, Math.min(240, current + delta * 24));
    if (next) target.style.marginLeft = `${next}px`;
    else target.style.removeProperty("margin-left");
    refreshFormat();
    emit();
  };

  const insertNoteLink = (title) => {
    const trigger = popover?.trigger;
    setPopover(null);
    restoreSelection();
    if (trigger === "typed") {
      // Replace the "[[query" the user typed with the finished link.
      const typed = typedQuery();
      const sel = window.getSelection();
      if (typed && sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        range.setStart(typed.node, typed.start);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange.current = range.cloneRange();
      }
    }
    exec("insertText", `[[${title}]] `);
  };

  /* ── editor events ───────────────────────────────────── */

  // Typing "[[" opens the note picker without taking focus: the text typed
  // after it filters the list until "]]" closes it or Enter picks a note.
  const onInput = () => {
    emit();
    const typed = typedQuery();
    if (popover?.kind === "note" && popover.trigger === "typed") {
      if (!typed) setPopover(null);
      else if (typed.query !== noteQuery) {
        setNoteQuery(typed.query);
        setNoteIndex(0);
      }
      return;
    }
    if (typed && typed.query === "") {
      saveSelection();
      setNoteQuery("");
      setNoteIndex(0);
      const pos = placeFrom(window.getSelection().getRangeAt(0).getBoundingClientRect());
      setPopover({ kind: "note", trigger: "typed", ...pos });
    }
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (popover?.kind === "note" && popover.trigger === "typed") {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (noteOptions.length) {
          const step = e.key === "ArrowDown" ? 1 : -1;
          setNoteIndex((i) => (i + step + noteOptions.length) % noteOptions.length);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const pick = noteOptions[noteIndex] || noteOptions[0];
        if (pick) insertNoteLink(pick.title);
        else setPopover(null);
        return;
      }
      if (["ArrowLeft", "ArrowRight", "Home", "End", "Tab"].includes(e.key)) setPopover(null);
    }
    if (mod && !e.shiftKey && key === "s") {
      e.preventDefault();
      onSaveNow?.();
      return;
    }
    if (mod && key === "k") {
      e.preventDefault();
      openLink(null);
      return;
    }
    if (mod && e.shiftKey && key === "x") {
      e.preventDefault();
      exec("strikeThrough");
      return;
    }
    if (mod && e.shiftKey && (e.key === "7" || e.key === "8" || e.key === "9")) {
      e.preventDefault();
      if (e.key === "7") toggleList("ol");
      else if (e.key === "8") toggleList("ul");
      else toggleChecklist();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      indent(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      const li = currentElement()?.closest("li");
      if (li && li.parentElement?.dataset.type === "checklist") {
        // A new checklist item starts unchecked even when split from a checked one.
        setTimeout(() => {
          const now = currentElement()?.closest("li");
          if (now && now !== li && !now.textContent.trim()) {
            now.dataset.checked = "false";
            emit();
          }
        }, 0);
      }
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) exec("insertHTML", sanitizeHtml(html));
    else if (text) exec("insertText", text);
  };

  const onClick = (e) => {
    const li = e.target.closest?.("li");
    if (li && isInside(li) && li.parentElement?.dataset.type === "checklist") {
      const rect = li.getBoundingClientRect();
      if (e.clientX - rect.left < 26) {
        li.dataset.checked = li.dataset.checked === "true" ? "false" : "true";
        emit();
        return;
      }
    }
    const anchor = e.target.closest?.("a");
    if (anchor && isInside(anchor) && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }
  };

  const focusEnd = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    // Land inside the last block so typing continues in it rather than
    // creating a bare text node at the root.
    range.selectNodeContents(el.lastElementChild || el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  /* ── popovers ────────────────────────────────────────── */

  const renderPopover = () => {
    if (!popover) return null;
    const shell = (children, width = "w-56") => (
      <div
        data-popover
        style={{ left: popover.left, top: popover.top }}
        className={`absolute z-30 ${width} rounded-xl bg-surface border border-edge shadow-xl p-1.5`}
      >
        {children}
      </div>
    );
    const stop = (e) => e.preventDefault();

    if (popover.kind === "block") {
      const styles = { h1: "text-lg font-bold", h2: "text-base font-bold", h3: "font-semibold", pre: "font-mono text-xs", blockquote: "italic" };
      return shell(
        BLOCKS.map((b) => (
          <button key={b.value} type="button" onMouseDown={stop} onClick={() => setBlock(b.value)} className={menuItemClass(fmt.block === b.value)}>
            <span className={styles[b.value] || ""}>{b.label}</span>
          </button>
        )),
      );
    }
    if (popover.kind === "size") {
      return shell(
        SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            onMouseDown={stop}
            onClick={() => {
              setPopover(null);
              exec("fontSize", s.value, { css: true });
            }}
            className={menuItemClass(false)}
          >
            {s.label}
          </button>
        )),
        "w-40",
      );
    }
    if (popover.kind === "color" || popover.kind === "highlight") {
      const highlight = popover.kind === "highlight";
      const colors = highlight ? HIGHLIGHTS : TEXT_COLORS;
      const command = highlight ? "hiliteColor" : "foreColor";
      return shell(
        <div className="space-y-1">
          <div className="grid grid-cols-5 gap-1.5 p-1">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Use ${c}`}
                onMouseDown={stop}
                onClick={() => {
                  setPopover(null);
                  exec(command, c, { css: true });
                }}
                className="w-7 h-7 rounded-full border border-edge hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={stop}
            onClick={() => {
              setPopover(null);
              if (highlight) exec("hiliteColor", "transparent", { css: true });
              else exec("removeFormat");
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
          >
            {highlight ? "Remove highlight" : "Clear text formatting"}
          </button>
        </div>,
        "w-52",
      );
    }
    if (popover.kind === "link") {
      return shell(
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
          className="p-1 space-y-2"
        >
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            aria-label="Link address"
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
          />
          <div className="flex items-center justify-between gap-2">
            <button type="submit" className="px-3 py-1 rounded-lg bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors">
              Apply
            </button>
            {fmt.link ? (
              <button
                type="button"
                onClick={() => {
                  setPopover(null);
                  exec("unlink");
                }}
                className="text-xs text-danger hover:underline"
              >
                Remove link
              </button>
            ) : null}
          </div>
        </form>,
        "w-64",
      );
    }
    if (popover.kind === "note") {
      const typed = popover.trigger === "typed";
      return shell(
        <div className="p-1 space-y-1.5">
          {typed ? (
            <p className="px-2 py-1 text-[11px] text-fg-subtle">
              Link to a note{query ? <> matching “<span className="text-fg">{query}</span>”</> : null} · ↑↓ then Enter
            </p>
          ) : (
            <input
              autoFocus
              value={noteQuery}
              onChange={(e) => {
                setNoteQuery(e.target.value);
                setNoteIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (noteOptions.length) {
                    const step = e.key === "ArrowDown" ? 1 : -1;
                    setNoteIndex((i) => (i + step + noteOptions.length) % noteOptions.length);
                  }
                  return;
                }
                if (e.key !== "Enter") return;
                e.preventDefault();
                const pick = noteOptions[noteIndex] || noteOptions[0];
                if (pick) insertNoteLink(pick.title);
              }}
              placeholder="Link to a note…"
              aria-label="Note to link"
              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
            />
          )}
          <div className="max-h-48 overflow-y-auto space-y-0.5 [scrollbar-width:thin]">
            {noteOptions.map((n, i) => (
              <button
                key={n.id}
                type="button"
                onMouseDown={stop}
                onMouseEnter={() => setNoteIndex(i)}
                onClick={() => insertNoteLink(n.title)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                  i === noteIndex ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                }`}
              >
                {n.create ? <IconPlus className="w-3.5 h-3.5 shrink-0" /> : <IconNote className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{n.create ? `Link to “${n.title}” (not created yet)` : n.title}</span>
              </button>
            ))}
            {!noteOptions.length ? (
              <p className="px-2 py-1 text-xs text-fg-subtle">
                {noteTitles.length ? "No matching notes. Keep typing a new title." : "No other notes yet. Type a title to link a note you will create later."}
              </p>
            ) : null}
          </div>
        </div>,
        "w-72",
      );
    }
    return null;
  };

  const blockLabel = BLOCKS.find((b) => b.value === fmt.block)?.label || "Text";

  return (
    <div ref={wrapRef} className="relative flex-1 min-h-0 flex flex-col">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex md:flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-edge overflow-x-auto md:overflow-visible [scrollbar-width:thin] bg-surface/60 shrink-0"
      >
        <ToolButton Icon={IconUndo} label="Undo (Ctrl+Z)" onClick={() => exec("undo")} />
        <ToolButton Icon={IconRedo} label="Redo (Ctrl+Y)" onClick={() => exec("redo")} />
        <Divider />
        <ToolButton label="Paragraph style" wide active={popover?.kind === "block"} onClick={(e) => openPopover(e, "block")} data-popover-trigger="">
          <span className="max-w-[5.5rem] truncate">{blockLabel}</span>
          <IconChevronDown className="w-3 h-3" />
        </ToolButton>
        <ToolButton Icon={IconSize} label="Text size" active={popover?.kind === "size"} onClick={(e) => openPopover(e, "size")} data-popover-trigger="" />
        <Divider />
        <ToolButton Icon={IconBold} label="Bold (Ctrl+B)" active={fmt.bold} onClick={() => exec("bold")} />
        <ToolButton Icon={IconItalic} label="Italic (Ctrl+I)" active={fmt.italic} onClick={() => exec("italic")} />
        <ToolButton Icon={IconUnderline} label="Underline (Ctrl+U)" active={fmt.underline} onClick={() => exec("underline")} />
        <ToolButton Icon={IconStrike} label="Strikethrough (Ctrl+Shift+X)" active={fmt.strike} onClick={() => exec("strikeThrough")} />
        <ToolButton Icon={IconTextColor} label="Text colour" active={popover?.kind === "color"} onClick={(e) => openPopover(e, "color")} data-popover-trigger="" />
        <ToolButton Icon={IconHighlight} label="Highlight" active={popover?.kind === "highlight"} onClick={(e) => openPopover(e, "highlight")} data-popover-trigger="" />
        <Divider />
        <ToolButton Icon={IconUl} label="Bulleted list (Ctrl+Shift+8)" active={fmt.ul} onClick={() => toggleList("ul")} />
        <ToolButton Icon={IconOl} label="Numbered list (Ctrl+Shift+7)" active={fmt.ol} onClick={() => toggleList("ol")} />
        <ToolButton Icon={IconChecklist} label="Checklist (Ctrl+Shift+9)" active={fmt.check} onClick={toggleChecklist} />
        <Divider />
        <ToolButton Icon={IconAlignLeft} label="Align left" active={!fmt.center && !fmt.right} onClick={() => exec("justifyLeft")} />
        <ToolButton Icon={IconAlignCenter} label="Align centre" active={fmt.center} onClick={() => exec("justifyCenter")} />
        <ToolButton Icon={IconAlignRight} label="Align right" active={fmt.right} onClick={() => exec("justifyRight")} />
        <ToolButton Icon={IconOutdent} label="Decrease indent (Shift+Tab)" onClick={() => indent(-1)} />
        <ToolButton Icon={IconIndent} label="Increase indent (Tab)" onClick={() => indent(1)} />
        <Divider />
        <ToolButton Icon={IconLink} label="Link (Ctrl+K)" active={fmt.link || popover?.kind === "link"} onClick={(e) => openLink(e)} data-popover-trigger="" />
        <ToolButton
          label="Link to a note (type [[ in the text)"
          wide
          active={popover?.kind === "note"}
          onClick={(e) => {
            setNoteQuery("");
            openPopover(e, "note", { trigger: "button" });
          }}
          data-popover-trigger=""
        >
          <span className="font-mono">[[ ]]</span>
        </ToolButton>
        <ToolButton Icon={IconRule} label="Horizontal rule" onClick={() => exec("insertHorizontalRule")} />
        <ToolButton Icon={IconEraser} label="Clear formatting" onClick={() => exec("removeFormat")} />
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
        onMouseDown={(e) => {
          if (!editorRef.current?.contains(e.target)) {
            e.preventDefault();
            focusEnd();
          }
        }}
      >
        <div className="relative max-w-3xl mx-auto px-5 sm:px-8 py-5">
          {empty ? (
            <div aria-hidden="true" className="absolute left-5 sm:left-8 top-5 text-[15px] text-fg-subtle pointer-events-none select-none">
              {placeholder}
            </div>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            role="textbox"
            aria-multiline="true"
            aria-label="Note content"
            className="nb-editor min-h-[50vh] outline-none"
            onInput={onInput}
            onKeyDown={onKeyDown}
            onKeyUp={refreshFormat}
            onMouseUp={refreshFormat}
            onPaste={onPaste}
            onClick={onClick}
          />
        </div>
      </div>

      {renderPopover()}
    </div>
  );
}
