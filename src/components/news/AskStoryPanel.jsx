"use client";

// Follow-up questions about one story. Answers come from the story's sources
// plus fresh MCP searches when needed; every paragraph cites [n] sources the
// user can open.

import React, { useState } from "react";
import { newsApi } from "@/lib/news/client";
import { openExternal } from "@/lib/platform";
import { ActionButton, Chip, IconChat, IconExternal, IconGlobe, Spinner, formatDate } from "@/components/news/newsUi";

const QUICK_PROMPTS = [
  "What does this mean?",
  "Give me more context.",
  "Why does this matter?",
  "What happened before this?",
  "Find other sources.",
  "Show me opposing viewpoints.",
];

function renderWithCitations(text, sources, onOpen) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const parts = [];
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const ids = m[1].split(",").map((x) => Number(x.trim()));
    parts.push(
      <span key={key++} className="inline-flex gap-0.5 align-baseline">
        {ids.map((id) => {
          const src = byId.get(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => src && onOpen(src.url)}
              title={src ? `${src.title || src.url} — ${src.publisher}` : `Source ${id}`}
              className="text-[10px] font-semibold px-1 rounded bg-primary-soft text-primary hover:bg-primary hover:text-primary-fg transition-colors"
            >
              {id}
            </button>
          );
        })}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts;
}

export default function AskStoryPanel({ story, onClose }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [error, setError] = useState("");

  const ask = async (text) => {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await newsApi("/api/news/stories/ask", {
        method: "POST",
        body: { storyId: story.id, question: q },
      });
      setExchanges((prev) => [...prev, { question: q, ...result }]);
      setQuestion("");
    } catch (e) {
      setError(e.message || "Could not answer the question.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-edge bg-surface-2 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-fg">
          <IconChat className="w-3.5 h-3.5 text-primary" />
          Ask about this story
        </p>
        <button type="button" onClick={onClose} className="text-xs text-fg-subtle hover:text-fg transition-colors">
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => (
          <Chip key={p} onClick={() => ask(p)} disabled={busy}>
            {p}
          </Chip>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Or ask your own question…"
          className="flex-1 px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
          disabled={busy}
        />
        <ActionButton type="submit" tone="primary" busy={busy} disabled={!question.trim()}>
          Ask
        </ActionButton>
      </form>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {busy ? (
        <p className="flex items-center gap-2 text-xs text-fg-muted">
          <Spinner className="w-3.5 h-3.5" />
          Checking the sources and searching for more context through MCP…
        </p>
      ) : null}

      {exchanges.map((x, i) => (
        <div key={i} className="rounded-lg bg-surface border border-edge p-3 space-y-2">
          <p className="text-xs font-semibold text-fg-muted">Q: {x.question}</p>
          {x.insufficient ? (
            <p className="text-[11px] text-warning">The retrieved sources do not fully cover this question.</p>
          ) : null}
          <div className="text-sm text-fg leading-relaxed space-y-2">
            {String(x.answer || "")
              .split(/\n{2,}/)
              .filter((p) => p.trim())
              .map((p, j) => (
                <p key={j}>{renderWithCitations(p, x.sources || [], openExternal)}</p>
              ))}
          </div>
          {x.searched && x.queries?.length ? (
            <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
              <IconGlobe className="w-3 h-3" />
              Searched the web for: {x.queries.join(" · ")}
            </p>
          ) : null}
          {(x.warnings?.length ? x.warnings : x.warning ? [x.warning] : []).map((w, k) => (
            <p key={k} className="text-[11px] text-warning">
              {w}
            </p>
          ))}
          {x.sources?.length ? (
            <ul className="space-y-1 pt-1 border-t border-edge">
              {x.sources.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[11px]">
                  <span className={`shrink-0 w-5 text-center rounded font-semibold ${s.cited ? "bg-primary-soft text-primary" : "bg-surface-2 text-fg-subtle"}`}>{s.id}</span>
                  <button
                    type="button"
                    onClick={() => openExternal(s.url)}
                    className="min-w-0 flex-1 text-left truncate text-fg-muted hover:text-primary transition-colors"
                    title={s.url}
                  >
                    {s.title || s.url}
                  </button>
                  <span className="shrink-0 text-fg-subtle">
                    {s.publisher}
                    {s.publishedAt ? ` · ${formatDate(s.publishedAt)}` : ""}
                  </span>
                  <IconExternal className="w-3 h-3 text-fg-subtle shrink-0" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
