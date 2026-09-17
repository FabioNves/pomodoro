import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookPost from "@/models/NotebookPost";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { SIGN_IN, objectId, run, apiError } from "@/lib/notebook/server";
import { PLATFORM_KEYS, POST_LIMITS, detectPlatform, mediaKindOf } from "@/lib/notebook/posts";
import {
  postDto,
  filesOf,
  claimFile,
  deleteFiles,
  storageLimits,
  storageUsed,
  sweepOrphanFiles,
} from "@/lib/notebook/postsServer";

const title = z.string().trim().max(POST_LIMITS.title);
const note = z.string().trim().max(POST_LIMITS.note);
const platform = z.enum(PLATFORM_KEYS);
const sourceUrl = z
  .string()
  .trim()
  .max(POST_LIMITS.sourceUrl)
  .refine((v) => !v || /^https?:\/\//i.test(v), "Must be an http(s) URL");
const tags = z
  .array(z.string().trim().min(1).max(POST_LIMITS.tag))
  .max(POST_LIMITS.tags)
  .transform((list) => [...new Set(list.map((t) => t.toLowerCase()))]);

async function storage(userId) {
  const limits = storageLimits();
  return { used: await storageUsed(userId), quota: limits.quota, maxFile: limits.maxFile };
}

// GET /api/notebook/posts — every saved post, newest first, with media URLs.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  return run("GET posts", async () => {
    await connectToDB();
    // Opening the view is also when abandoned uploads are cleared, so the
    // space a cancelled drag-and-drop held comes back on its own.
    await sweepOrphanFiles(auth.userId);
    const posts = await NotebookPost.find({ user: auth.userId }).sort({ pinned: -1, createdAt: -1 });
    const files = await filesOf(posts);
    return Response.json({ posts: posts.map((p) => postDto(p, files)), storage: await storage(auth.userId) });
  });
}

// POST /api/notebook/posts
// { fileId?, thumbId?, title?, note?, platform?, sourceUrl?, width?, height?, duration?, tags? }
// A post needs a finished upload (fileId) or a link (sourceUrl), or both.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      fileId: objectId.nullable().optional(),
      thumbId: objectId.nullable().optional(),
      title: title.optional(),
      note: note.optional(),
      platform: platform.optional(),
      sourceUrl: sourceUrl.optional(),
      width: z.number().int().min(0).max(100000).optional(),
      height: z.number().int().min(0).max(100000).optional(),
      duration: z.number().min(0).max(24 * 3600).optional(),
      tags: tags.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST posts", async () => {
    await connectToDB();
    const { fileId, thumbId, sourceUrl: url = "", ...rest } = body.data;
    if (!fileId && !url) throw apiError(400, "Add a file or a link");

    const file = await claimFile(auth.userId, fileId);
    const thumb = thumbId && thumbId !== fileId ? await claimFile(auth.userId, thumbId, { kinds: ["image"] }) : null;
    const kind = file ? mediaKindOf(file.mime) : "link";

    const post = await NotebookPost.create({
      user: auth.userId,
      title: rest.title || "",
      note: rest.note || "",
      platform: rest.platform || (url ? detectPlatform(url) : "other"),
      sourceUrl: url,
      kind,
      file: file ? file._id : null,
      thumb: thumb ? thumb._id : null,
      width: rest.width || 0,
      height: rest.height || 0,
      duration: rest.duration || 0,
      tags: rest.tags || [],
    });
    const files = await filesOf([post]);
    return Response.json({ post: postDto(post, files), storage: await storage(auth.userId) }, { status: 201 });
  });
}

// PATCH /api/notebook/posts  { id, title?, note?, platform?, sourceUrl?, tags?, pinned? }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      title: title.optional(),
      note: note.optional(),
      platform: platform.optional(),
      sourceUrl: sourceUrl.optional(),
      tags: tags.optional(),
      pinned: z.boolean().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH posts", async () => {
    await connectToDB();
    const { id, ...patch } = body.data;
    const post = await NotebookPost.findOne({ _id: id, user: auth.userId });
    if (!post) throw apiError(404, "Post not found");
    if (patch.sourceUrl !== undefined && !patch.sourceUrl && post.kind === "link") {
      throw apiError(400, "A link post needs its link");
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) post[key] = value;
    }
    await post.save();
    const files = await filesOf([post]);
    return Response.json({ post: postDto(post, files) });
  });
}

// DELETE /api/notebook/posts  { id }  — the post and its stored files.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE posts", async () => {
    await connectToDB();
    const post = await NotebookPost.findOneAndDelete({ _id: body.data.id, user: auth.userId });
    if (!post) throw apiError(404, "Post not found");
    await deleteFiles([post.file, post.thumb]);
    return Response.json({ ok: true, id: String(post._id), storage: await storage(auth.userId) });
  });
}
