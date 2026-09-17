import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookDocument from "@/models/NotebookDocument";
import { requireUser } from "@/lib/sessionAuth";
import { validateSearchParams } from "@/utils/apiValidation";
import { htmlToText } from "@/lib/notebook/text";
import { orderedTabs } from "@/lib/notebook/tree";
import { SIGN_IN, run, docSummaryDto } from "@/lib/notebook/server";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/notebook/search?q=
// Full-text search over note titles, subjects and tab contents. Returns note
// summaries plus a snippet around the first match.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, z.object({ q: z.string().trim().min(1).max(80) }));
  if (!query.ok) return query.response;

  return run("GET search", async () => {
    await connectToDB();
    const q = query.data.q;
    const re = new RegExp(escapeRegex(q), "i");
    const docs = await NotebookDocument.find({
      user: auth.userId,
      $or: [{ title: re }, { subjects: re }, { "tabs.content": re }],
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    const results = [];
    for (const doc of docs) {
      const text = orderedTabs(doc.tabs)
        .map((t) => htmlToText(t.content))
        .join("\n");
      const at = text.toLowerCase().indexOf(q.toLowerCase());
      let snippet = "";
      if (at >= 0) {
        const start = Math.max(0, at - 60);
        const end = Math.min(text.length, at + q.length + 100);
        snippet = `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`;
      }
      const inMeta = re.test(doc.title) || (doc.subjects || []).some((s) => re.test(s));
      // A hit inside the HTML markup only (a tag or attribute name) is not a match.
      if (!snippet && !inMeta) continue;
      results.push({ ...docSummaryDto(doc), snippet });
    }
    return Response.json({ results });
  });
}
