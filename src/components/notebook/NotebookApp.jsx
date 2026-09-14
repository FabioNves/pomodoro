"use client";

// The notebook screen: sidebar (views + folder tree) next to either the
// selected view (Folders, All notes, a saved view, the Brain graph) or the
// open note. Data comes from /api/notebook/*; the view, folder, note and tab
// live in the query string so links and reloads keep their place.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { notebookApi } from "@/lib/notebook/client";
import { subjectKey } from "@/lib/notebook/subjects";
import { isBlankHtml } from "@/lib/notebook/sanitize";
import { buildFolderIndex, buildLinkIndex, tabChildren } from "@/lib/notebook/tree";
import NotebookSidebar from "@/components/notebook/NotebookSidebar";
import NotesView from "@/components/notebook/NotesView";
import BrainView from "@/components/notebook/BrainView";
import DocumentEditor from "@/components/notebook/DocumentEditor";
import ViewEditor from "@/components/notebook/ViewEditor";
import {
  ActionButton,
  IconAlert,
  IconMenu,
  IconNotePlus,
  Spinner,
} from "@/components/notebook/notebookUi";

/** Summary shape (what the note lists hold) of a full note. */
function summaryOf(doc) {
  const { tabs, ...rest } = doc;
  return { ...rest, tabCount: tabs ? tabs.length : (rest.tabCount ?? 0) };
}

function Loading({ label = "Loading your notebook…" }) {
  return (
    <div className="flex-1 flex items-center justify-center gap-2 text-sm text-fg-muted">
      <Spinner className="w-4 h-4" />
      {label}
    </div>
  );
}

export default function NotebookApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") || "folders";
  const docId = searchParams.get("doc");
  const tabParam = searchParams.get("tab");
  const folderParam = searchParams.get("folder");
  const subjectParam = searchParams.get("subject");

  const [folders, setFolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [settings, setSettings] = useState({ subjects: [], views: [] });
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [openDoc, setOpenDoc] = useState(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewEditor, setViewEditor] = useState(null); // { view } to edit, {} to create
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setParams = useCallback(
    (patch, { push = false } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      const url = params.toString() ? `/notebook?${params.toString()}` : "/notebook";
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, searchParams],
  );

  /* ── state helpers ───────────────────────────────────── */

  const upsertSummary = useCallback((summary) => {
    setDocs((prev) =>
      prev.some((d) => d.id === summary.id)
        ? prev.map((d) => (d.id === summary.id ? { ...d, ...summary } : d))
        : [summary, ...prev],
    );
  }, []);

  const patchDoc = useCallback((id, patch) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setOpenDoc((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }, []);

  /** Applies a tabs-route reply: full note when the structure changed, summary otherwise. */
  const applyDocResponse = useCallback(
    (data) => {
      if (data.document) {
        setOpenDoc((prev) => (prev && prev.id === data.document.id ? data.document : prev));
        upsertSummary(summaryOf(data.document));
      } else if (data.summary) {
        upsertSummary(data.summary);
      }
    },
    [upsertSummary],
  );

  /* ── loading ─────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await notebookApi("/api/notebook");
      if (!mountedRef.current) return;
      setFolders(data.folders);
      setDocs(data.documents);
      setSettings(data.settings);
      setSuggested(data.suggestedSubjects || []);
    } catch (e) {
      if (!mountedRef.current) return;
      setLoadError(e.message || "Could not load your notebook.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Open the note named in the URL (with its tab contents).
  useEffect(() => {
    if (!docId) {
      setOpenDoc(null);
      return undefined;
    }
    if (openDoc?.id === docId) return undefined;
    let cancelled = false;
    setOpenLoading(true);
    notebookApi(`/api/notebook/documents?id=${encodeURIComponent(docId)}`)
      .then((data) => {
        if (cancelled) return;
        setOpenDoc(data.document);
        upsertSummary(summaryOf(data.document));
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e.message || "Could not open the note.");
        setParams({ doc: null, tab: null });
      })
      .finally(() => {
        if (!cancelled) setOpenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  /* ── derived ─────────────────────────────────────────── */

  const folderIndex = useMemo(() => buildFolderIndex(folders), [folders]);
  const linkIndex = useMemo(() => buildLinkIndex(docs), [docs]);
  const customView = viewParam.startsWith("v:")
    ? settings.views.find((v) => v.id === viewParam.slice(2)) || null
    : null;
  const mode =
    viewParam === "brain" ? "brain" : viewParam === "notes" ? "notes" : customView ? "custom" : "folders";
  const activeViewKey = mode === "custom" ? `v:${customView.id}` : mode;
  const activeTabId =
    openDoc && openDoc.tabs.some((t) => t.id === tabParam) ? tabParam : openDoc?.tabs[0]?.id || null;

  /* ── navigation ──────────────────────────────────────── */

  const openDocById = useCallback(
    (id, tabId = null) => {
      setSidebarOpen(false);
      setParams({ doc: id, tab: tabId }, { push: true });
    },
    [setParams],
  );

  const selectView = (key) => {
    setSidebarOpen(false);
    setSearch("");
    setParams({ view: key === "folders" ? null : key, doc: null, tab: null, folder: null, subject: null });
  };

  const openFolder = (id) => {
    setSidebarOpen(false);
    setSearch("");
    setParams({ view: null, folder: id, doc: null, tab: null, subject: null });
  };

  const showSubject = (name) => {
    setSidebarOpen(false);
    setParams({ view: "notes", subject: name, doc: null, tab: null, folder: null });
  };

  /* ── folders ─────────────────────────────────────────── */

  const createFolder = async (parent = null) => {
    try {
      const data = await notebookApi("/api/notebook/folders", {
        method: "POST",
        body: { name: "New folder", parent },
      });
      setFolders((prev) => [...prev, data.folder]);
      return data.folder;
    } catch (e) {
      toast.error(e.message || "Could not create the folder.");
      return null;
    }
  };

  const patchFolder = async (id, patch, failure) => {
    const before = folders;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    try {
      const data = await notebookApi("/api/notebook/folders", { method: "PATCH", body: { id, ...patch } });
      setFolders((prev) => prev.map((f) => (f.id === id ? data.folder : f)));
      return true;
    } catch (e) {
      setFolders(before);
      toast.error(e.message || failure);
      return false;
    }
  };

  const renameFolder = (id, name) => patchFolder(id, { name }, "Could not rename the folder.");
  const moveFolder = (id, parent) => patchFolder(id, { parent }, "Could not move the folder.");

  const deleteFolder = async (folder) => {
    const parentName = folder.parent ? folderIndex.byId.get(folder.parent)?.name : null;
    const hasSubfolders = folders.some((f) => f.parent === folder.id);
    const ok = window.confirm(
      `Delete folder "${folder.name}"${hasSubfolders ? " and its subfolders" : ""}? Notes inside will move to ${
        parentName ? `"${parentName}"` : "the top level"
      }.`,
    );
    if (!ok) return;
    try {
      const data = await notebookApi("/api/notebook/folders", { method: "DELETE", body: { id: folder.id } });
      const gone = new Set(data.deletedIds);
      setFolders((prev) => prev.filter((f) => !gone.has(f.id)));
      setDocs((prev) => prev.map((d) => (gone.has(d.folder) ? { ...d, folder: data.movedTo } : d)));
      setOpenDoc((prev) => (prev && gone.has(prev.folder) ? { ...prev, folder: data.movedTo } : prev));
      setSettings((s) => ({
        ...s,
        views: s.views.map((v) => (gone.has(v.folder) ? { ...v, folder: data.movedTo } : v)),
      }));
      if (folderParam && gone.has(folderParam)) setParams({ folder: data.movedTo });
      toast.success("Folder deleted.");
    } catch (e) {
      toast.error(e.message || "Could not delete the folder.");
    }
  };

  /* ── notes ───────────────────────────────────────────── */

  const createDoc = async ({ folder = null, subjects = [], title } = {}) => {
    try {
      const data = await notebookApi("/api/notebook/documents", {
        method: "POST",
        body: { folder, subjects, ...(title ? { title } : {}) },
      });
      const doc = data.document;
      upsertSummary(summaryOf(doc));
      setOpenDoc(doc);
      setSidebarOpen(false);
      setSearch("");
      setParams({ doc: doc.id, tab: doc.tabs[0]?.id || null }, { push: true });
      return doc;
    } catch (e) {
      toast.error(e.message || "Could not create the note.");
      return null;
    }
  };

  const updateDoc = async (id, patch) => {
    const before = docs.find((d) => d.id === id) || (openDoc?.id === id ? openDoc : null);
    patchDoc(id, patch);
    try {
      const data = await notebookApi("/api/notebook/documents", { method: "PATCH", body: { id, ...patch } });
      patchDoc(id, data.document);
      return true;
    } catch (e) {
      if (before) {
        const rollback = {};
        for (const key of Object.keys(patch)) rollback[key] = before[key];
        patchDoc(id, rollback);
      }
      toast.error(e.message || "Could not update the note.");
      return false;
    }
  };

  const renameDoc = (id, title) => updateDoc(id, { title });
  const moveDoc = (id, folder) => updateDoc(id, { folder });
  const togglePin = (doc) => updateDoc(doc.id, { pinned: !doc.pinned });
  const setDocSubjects = (id, subjects) => updateDoc(id, { subjects });

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await notebookApi("/api/notebook/documents", { method: "DELETE", body: { id: doc.id } });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      if (docId === doc.id) {
        setOpenDoc(null);
        setParams({ doc: null, tab: null });
      }
      toast.success("Note deleted.");
    } catch (e) {
      toast.error(e.message || "Could not delete the note.");
    }
  };

  /* ── tabs ────────────────────────────────────────────── */

  const addTab = async (parent = null) => {
    if (!openDoc) return;
    try {
      const data = await notebookApi("/api/notebook/documents/tabs", {
        method: "POST",
        body: { docId: openDoc.id, parent },
      });
      applyDocResponse(data);
      setParams({ tab: data.tabId });
    } catch (e) {
      toast.error(e.message || "Could not add the tab.");
    }
  };

  const updateTab = async (tabId, patch) => {
    if (!openDoc) return false;
    try {
      const data = await notebookApi("/api/notebook/documents/tabs", {
        method: "PATCH",
        body: { docId: openDoc.id, tabId, ...patch },
      });
      applyDocResponse(data);
      return true;
    } catch (e) {
      toast.error(e.message || "Could not update the tab.");
      return false;
    }
  };

  // Called by the editor's autosave. Throws so the editor can show the failure.
  const saveTabContent = useCallback(
    async (docIdToSave, tabId, content, { keepalive = false } = {}) => {
      const data = await notebookApi("/api/notebook/documents/tabs", {
        method: "PATCH",
        body: { docId: docIdToSave, tabId, content },
        keepalive,
      });
      if (!mountedRef.current) return data;
      if (data.summary) upsertSummary(data.summary);
      setOpenDoc((prev) =>
        prev && prev.id === docIdToSave
          ? {
              ...prev,
              ...(data.summary || {}),
              tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, content } : t)),
            }
          : prev,
      );
      return data;
    },
    [upsertSummary],
  );

  const deleteTab = async (tab) => {
    if (!openDoc) return;
    const children = tabChildren(openDoc.tabs, tab.id).length;
    if (children || !isBlankHtml(tab.content)) {
      const ok = window.confirm(`Delete tab "${tab.title}"${children ? " and its subtabs" : ""}?`);
      if (!ok) return;
    }
    try {
      const data = await notebookApi("/api/notebook/documents/tabs", {
        method: "DELETE",
        body: { docId: openDoc.id, tabId: tab.id },
      });
      applyDocResponse(data);
      if (!data.document.tabs.some((t) => t.id === tabParam)) {
        setParams({ tab: data.document.tabs[0]?.id || null });
      }
    } catch (e) {
      toast.error(e.message || "Could not delete the tab.");
    }
  };

  /* ── subjects ────────────────────────────────────────── */

  const addSubject = async (name, color) => {
    try {
      const data = await notebookApi("/api/notebook/subjects", {
        method: "POST",
        body: { name, ...(color ? { color } : {}) },
      });
      setSettings(data.settings);
      const key = subjectKey(name);
      return data.settings.subjects.find((s) => subjectKey(s.name) === key) || null;
    } catch (e) {
      toast.error(e.message || "Could not add the subject.");
      return null;
    }
  };

  const renameSubject = async (name, newName) => {
    try {
      const data = await notebookApi("/api/notebook/subjects", {
        method: "PATCH",
        body: { name, newName },
      });
      setSettings(data.settings);
      const rename = (d) =>
        d.subjects?.includes(name) ? { ...d, subjects: d.subjects.map((s) => (s === name ? newName : s)) } : d;
      setDocs((prev) => prev.map(rename));
      setOpenDoc((prev) => (prev ? rename(prev) : prev));
      if (subjectParam === name) setParams({ subject: newName });
      return true;
    } catch (e) {
      toast.error(e.message || "Could not rename the subject.");
      return false;
    }
  };

  const deleteSubject = async (name) => {
    const count = docs.filter((d) => d.subjects.includes(name)).length;
    const ok = window.confirm(
      `Remove the subject "${name}"?${count ? ` It is removed from ${count} note${count === 1 ? "" : "s"}.` : ""}`,
    );
    if (!ok) return;
    try {
      const data = await notebookApi("/api/notebook/subjects", { method: "DELETE", body: { name } });
      setSettings(data.settings);
      const strip = (d) =>
        d.subjects?.includes(name) ? { ...d, subjects: d.subjects.filter((s) => s !== name) } : d;
      setDocs((prev) => prev.map(strip));
      setOpenDoc((prev) => (prev ? strip(prev) : prev));
      if (subjectParam === name) setParams({ subject: null });
    } catch (e) {
      toast.error(e.message || "Could not remove the subject.");
    }
  };

  /* ── saved views ─────────────────────────────────────── */

  const saveView = async (fields, existing) => {
    try {
      if (existing) {
        const data = await notebookApi("/api/notebook/views", { method: "PATCH", body: { id: existing.id, ...fields } });
        setSettings(data.settings);
      } else {
        const data = await notebookApi("/api/notebook/views", { method: "POST", body: fields });
        setSettings(data.settings);
        setParams({ view: `v:${data.viewId}`, doc: null, tab: null, folder: null, subject: null });
      }
      setViewEditor(null);
      toast.success(existing ? "View updated." : "View created.");
      return true;
    } catch (e) {
      toast.error(e.message || "Could not save the view.");
      return false;
    }
  };

  const deleteView = async (view) => {
    if (!window.confirm(`Delete the view "${view.name}"?`)) return;
    try {
      const data = await notebookApi("/api/notebook/views", { method: "DELETE", body: { id: view.id } });
      setSettings(data.settings);
      setViewEditor(null);
      if (activeViewKey === `v:${view.id}`) setParams({ view: null });
    } catch (e) {
      toast.error(e.message || "Could not delete the view.");
    }
  };

  /* ── render ──────────────────────────────────────────── */

  const newNoteHere = () =>
    createDoc({
      folder: mode === "folders" ? folderParam || null : customView?.folder || openDoc?.folder || null,
      subjects: subjectParam ? [subjectParam] : customView?.subjects || [],
    });

  const sidebarProps = {
    views: settings.views,
    activeViewKey,
    onSelectView: selectView,
    onNewView: () => setViewEditor({}),
    onEditView: (view) => setViewEditor({ view }),
    onDeleteView: deleteView,
    folders,
    folderIndex,
    docs,
    currentFolderId: mode === "folders" ? folderParam : null,
    openDocId: docId,
    search,
    onSearch: (value) => {
      setSearch(value);
      if (value && docId) setParams({ doc: null, tab: null });
      if (value && mode === "brain") setParams({ view: null, doc: null, tab: null });
    },
    onOpenDoc: openDocById,
    onOpenFolder: openFolder,
    onCreateDoc: (folder) => createDoc({ folder }),
    onCreateFolder: createFolder,
    onRenameFolder: renameFolder,
    onMoveFolder: moveFolder,
    onDeleteFolder: deleteFolder,
    onRenameDoc: renameDoc,
    onMoveDoc: moveDoc,
    onDeleteDoc: deleteDoc,
    onTogglePin: togglePin,
  };

  let content;
  if (loading) {
    content = <Loading />;
  } else if (docId) {
    content =
      openDoc && openDoc.id === docId ? (
        <DocumentEditor
          key={openDoc.id}
          doc={openDoc}
          docs={docs}
          folders={folders}
          folderIndex={folderIndex}
          settings={settings}
          linkIndex={linkIndex}
          activeTabId={activeTabId}
          onSelectTab={(tabId) => setParams({ tab: tabId })}
          onBack={() => setParams({ doc: null, tab: null })}
          onRenameDoc={(title) => renameDoc(openDoc.id, title)}
          onMoveDoc={(folder) => moveDoc(openDoc.id, folder)}
          onTogglePin={() => togglePin(openDoc)}
          onDeleteDoc={() => deleteDoc(openDoc)}
          onSetSubjects={(subjects) => setDocSubjects(openDoc.id, subjects)}
          onAddSubject={addSubject}
          onAddTab={addTab}
          onRenameTab={(tabId, title) => updateTab(tabId, { title })}
          onMoveTab={(tabId, patch) => updateTab(tabId, patch)}
          onDeleteTab={deleteTab}
          onSaveTab={saveTabContent}
          onOpenDoc={openDocById}
          onOpenFolder={openFolder}
          onCreateDoc={(fields) => createDoc({ folder: openDoc.folder, ...fields })}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      ) : (
        <Loading label={openLoading ? "Opening note…" : "Loading…"} />
      );
  } else if (mode === "brain") {
    content = (
      <BrainView
        docs={docs}
        settings={settings}
        suggested={suggested}
        linkIndex={linkIndex}
        folderIndex={folderIndex}
        onOpenDoc={openDocById}
        onAddSubject={addSubject}
        onRenameSubject={renameSubject}
        onDeleteSubject={deleteSubject}
        onSetDocSubjects={setDocSubjects}
        onShowSubject={showSubject}
        onCreateDoc={(subjects) => createDoc({ subjects })}
      />
    );
  } else {
    content = (
      <NotesView
        mode={mode}
        view={customView}
        folderId={mode === "folders" ? folderParam : null}
        docs={docs}
        folders={folders}
        folderIndex={folderIndex}
        settings={settings}
        search={search}
        onClearSearch={() => setSearch("")}
        subjectFilter={mode === "notes" ? subjectParam : null}
        onSubjectFilter={(name) => setParams({ subject: name })}
        onOpenDoc={openDocById}
        onOpenFolder={openFolder}
        onCreateDoc={(folder, subjects) => createDoc({ folder, subjects })}
        onCreateFolder={createFolder}
        onRenameDoc={renameDoc}
        onMoveDoc={moveDoc}
        onDeleteDoc={deleteDoc}
        onTogglePin={togglePin}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onEditView={(view) => setViewEditor({ view })}
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent leading-tight">
            Notebook
          </h1>
          <p className="hidden sm:block text-xs text-fg-muted mt-0.5">
            Notes with tabs, folders, saved views and a Brain graph of your subjects.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ActionButton tone="primary" Icon={IconNotePlus} onClick={newNoteHere} disabled={loading || !!loadError}>
            New note
          </ActionButton>
          <button
            type="button"
            className="md:hidden p-2 rounded-lg border border-edge text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
            aria-label="Open notebook menu"
            onClick={() => setSidebarOpen(true)}
          >
            <IconMenu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/40 bg-danger-soft text-danger text-sm">
          <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">{loadError}</div>
          <ActionButton size="sm" onClick={load}>
            Retry
          </ActionButton>
        </div>
      ) : (
        <div className="flex bg-surface/70 backdrop-blur-sm rounded-2xl border border-edge shadow-md overflow-hidden h-[calc(100dvh-14rem)] md:h-[calc(100dvh-10rem)] min-h-[520px] transition-colors duration-300">
          <div className="hidden md:flex w-64 lg:w-72 shrink-0 border-r border-edge flex-col min-h-0">
            <NotebookSidebar {...sidebarProps} />
          </div>

          <AnimatePresence>
            {sidebarOpen ? (
              <motion.div
                className="fixed inset-0 z-[60] md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
                <motion.div
                  className="absolute inset-y-0 left-0 w-[85vw] max-w-sm bg-surface border-r border-edge shadow-2xl flex flex-col"
                  initial={{ x: -360 }}
                  animate={{ x: 0 }}
                  exit={{ x: -360 }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <NotebookSidebar {...sidebarProps} onClose={() => setSidebarOpen(false)} />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex-1 min-w-0 flex flex-col min-h-0">{content}</div>
        </div>
      )}

      <ViewEditor
        open={!!viewEditor}
        view={viewEditor?.view || null}
        folders={folders}
        folderIndex={folderIndex}
        subjects={settings.subjects}
        onSave={(fields) => saveView(fields, viewEditor?.view || null)}
        onDelete={viewEditor?.view ? () => deleteView(viewEditor.view) : null}
        onClose={() => setViewEditor(null)}
      />
    </div>
  );
}
