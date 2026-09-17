import { connectToDB } from "@/lib/db";
import NotebookFolder from "@/models/NotebookFolder";
import NotebookDocument from "@/models/NotebookDocument";
import NotebookQuote from "@/models/NotebookQuote";
import NotebookPost from "@/models/NotebookPost";
import { requireUser } from "@/lib/sessionAuth";
import { SUGGESTED_SUBJECTS } from "@/lib/notebook/subjects";
import {
  SIGN_IN,
  run,
  ensureSettings,
  folderDto,
  docSummaryDto,
  settingsDto,
} from "@/lib/notebook/server";

// GET /api/notebook
// Everything the notebook screen needs in one call: folders, note summaries
// (no tab contents), the user's subjects and saved views, and how many
// quotes and saved posts there are (those views load their own lists).
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  return run("GET /api/notebook", async () => {
    await connectToDB();
    const [folders, documents, settings, quotes, posts] = await Promise.all([
      NotebookFolder.find({ user: auth.userId }).sort({ order: 1, name: 1 }),
      NotebookDocument.find({ user: auth.userId })
        .select("-tabs.content")
        .sort({ updatedAt: -1 }),
      ensureSettings(auth.userId),
      NotebookQuote.countDocuments({ user: auth.userId }),
      NotebookPost.countDocuments({ user: auth.userId }),
    ]);
    return Response.json({
      folders: folders.map(folderDto),
      documents: documents.map(docSummaryDto),
      settings: settingsDto(settings),
      suggestedSubjects: SUGGESTED_SUBJECTS,
      counts: { quotes, posts },
    });
  });
}
