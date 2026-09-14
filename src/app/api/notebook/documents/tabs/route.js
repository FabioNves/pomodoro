import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookDocument from "@/models/NotebookDocument";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { stripDangerousHtml } from "@/lib/notebook/text";
import { tabSubtreeIds } from "@/lib/notebook/tree";
import {
  SIGN_IN,
  LIMITS,
  objectId,
  run,
  apiError,
  docDto,
  docSummaryDto,
  deriveDocument,
  assertTabParent,
  renumberSiblings,
} from "@/lib/notebook/server";

const tabTitle = z.string().trim().min(1).max(LIMITS.tabTitle);

async function loadDoc(userId, docId) {
  const doc = await NotebookDocument.findOne({ _id: docId, user: userId });
  if (!doc) throw apiError(404, "Note not found");
  return doc;
}

// POST /api/notebook/documents/tabs  { docId, title?, parent? }
export async function POST(req) {
  const auth = requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      docId: objectId,
      title: tabTitle.optional(),
      parent: objectId.nullable().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST tabs", async () => {
    await connectToDB();
    const doc = await loadDoc(auth.userId, body.data.docId);
    if (doc.tabs.length >= LIMITS.tabs) {
      throw apiError(400, `A note can have at most ${LIMITS.tabs} tabs`);
    }
    const parent = body.data.parent || null;
    assertTabParent(doc, parent);
    const siblings = doc.tabs.filter((t) => (t.parent || null) === parent);
    doc.tabs.push({
      title: body.data.title || `Tab ${doc.tabs.length + 1}`,
      content: "",
      parent,
      order: siblings.length,
    });
    const tab = doc.tabs[doc.tabs.length - 1];
    await doc.save({ timestamps: false });
    return Response.json({ document: docDto(doc), tabId: String(tab._id) }, { status: 201 });
  });
}

// PATCH /api/notebook/documents/tabs  { docId, tabId, title?, content?, parent?, order? }
// `content` saves come from the editor's autosave; the reply then carries the
// note's refreshed summary only. Structural changes (title, parent, order)
// also return the whole note.
export async function PATCH(req) {
  const auth = requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      docId: objectId,
      tabId: objectId,
      title: tabTitle.optional(),
      content: z.string().max(LIMITS.content).optional(),
      parent: objectId.nullable().optional(),
      order: z.number().int().min(0).max(1000).optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH tabs", async () => {
    await connectToDB();
    const { docId, tabId, title, content, parent, order } = body.data;
    const doc = await loadDoc(auth.userId, docId);
    const tab = doc.tabs.id(tabId);
    if (!tab) throw apiError(404, "Tab not found");

    let structural = false;
    if (title !== undefined) {
      tab.title = title;
      structural = true;
    }
    if (parent !== undefined && (tab.parent || null) !== (parent || null)) {
      assertTabParent(doc, parent || null, { movingId: tabId });
      const previous = tab.parent || null;
      tab.parent = parent || null;
      renumberSiblings(doc, previous);
      tab.order = Number.MAX_SAFE_INTEGER; // last among the new siblings unless `order` says otherwise
      renumberSiblings(doc, tab.parent, order !== undefined ? { movedId: tabId, index: order } : {});
      structural = true;
    } else if (order !== undefined) {
      renumberSiblings(doc, tab.parent || null, { movedId: tabId, index: order });
      structural = true;
    }

    let edited = false;
    if (content !== undefined) {
      tab.content = stripDangerousHtml(content);
      deriveDocument(doc);
      edited = true;
    }

    await doc.save(edited ? undefined : { timestamps: false });
    return Response.json({
      summary: docSummaryDto(doc),
      ...(structural ? { document: docDto(doc) } : {}),
    });
  });
}

// DELETE /api/notebook/documents/tabs  { docId, tabId }  — removes the tab and its subtabs.
export async function DELETE(req) {
  const auth = requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ docId: objectId, tabId: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE tabs", async () => {
    await connectToDB();
    const doc = await loadDoc(auth.userId, body.data.docId);
    const tab = doc.tabs.id(body.data.tabId);
    if (!tab) throw apiError(404, "Tab not found");
    const ids = tabSubtreeIds(doc.tabs, body.data.tabId);
    if (ids.size >= doc.tabs.length) throw apiError(400, "A note needs at least one tab");
    const parent = tab.parent || null;
    for (const id of ids) doc.tabs.pull(id);
    renumberSiblings(doc, parent);
    deriveDocument(doc);
    await doc.save();
    return Response.json({ document: docDto(doc) });
  });
}
