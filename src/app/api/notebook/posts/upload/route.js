import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookPost from "@/models/NotebookPost";
import NotebookPostFile from "@/models/NotebookPostFile";
import NotebookPostChunk from "@/models/NotebookPostChunk";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody, validateSearchParams } from "@/utils/apiValidation";
import { SIGN_IN, objectId, run, apiError } from "@/lib/notebook/server";
import { POST_LIMITS, IMAGE_TYPES, VIDEO_TYPES, formatBytes } from "@/lib/notebook/posts";
import { storageLimits, storageUsed, sweepOrphanFiles, deleteFiles } from "@/lib/notebook/postsServer";

// Chunked uploads for saved posts. The browser starts an upload (POST),
// sends the pieces one request at a time (PUT, raw bytes) and, once the
// last piece is in, creates the post with the file id. Each request stays
// under the request-body limit of serverless hosts.

export const maxDuration = 60;

// POST /api/notebook/posts/upload  { name, mime, size }  -> { fileId, chunkSize, chunkCount }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      name: z.string().trim().max(POST_LIMITS.fileName).optional(),
      mime: z.string().trim().toLowerCase().max(100),
      size: z.number().int().min(1),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST posts/upload", async () => {
    await connectToDB();
    const { name = "", mime, size } = body.data;
    if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(mime)) {
      throw apiError(415, "Only images and videos can be saved as posts");
    }
    const limits = storageLimits();
    if (size > limits.maxFile) {
      throw apiError(413, `Files can be at most ${formatBytes(limits.maxFile)}`);
    }
    await sweepOrphanFiles(auth.userId);
    const used = await storageUsed(auth.userId);
    if (used + size > limits.quota) {
      throw apiError(413, `Not enough space: ${formatBytes(limits.quota - used)} of ${formatBytes(limits.quota)} left`);
    }
    const file = await NotebookPostFile.create({
      user: auth.userId,
      name,
      mime,
      size,
      chunkSize: limits.chunkSize,
      chunkCount: Math.ceil(size / limits.chunkSize),
    });
    return Response.json(
      { fileId: String(file._id), chunkSize: file.chunkSize, chunkCount: file.chunkCount },
      { status: 201 },
    );
  });
}

// PUT /api/notebook/posts/upload?id=&n=   body: the raw bytes of chunk n
export async function PUT(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, z.object({ id: objectId, n: z.coerce.number().int().min(0) }));
  if (!query.ok) return query.response;

  return run("PUT posts/upload", async () => {
    await connectToDB();
    const { id, n } = query.data;
    const file = await NotebookPostFile.findOne({ _id: id, user: auth.userId });
    if (!file) throw apiError(404, "Upload not found");
    if (file.complete) throw apiError(409, "The upload is already complete");
    if (n >= file.chunkCount) throw apiError(400, "Chunk index out of range");

    const bytes = Buffer.from(await req.arrayBuffer());
    const expected = n < file.chunkCount - 1 ? file.chunkSize : file.size - file.chunkSize * (file.chunkCount - 1);
    if (bytes.length !== expected) {
      throw apiError(400, `Chunk ${n} should be ${expected} bytes, got ${bytes.length}`);
    }

    const result = await NotebookPostChunk.updateOne(
      { file: file._id, n },
      { $setOnInsert: { data: bytes } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      const updated = await NotebookPostFile.findOneAndUpdate(
        { _id: file._id },
        { $inc: { received: 1 } },
        { new: true },
      );
      // The upload can be cancelled while a chunk is still on its way.
      if (!updated) {
        await NotebookPostChunk.deleteMany({ file: file._id });
        throw apiError(404, "Upload not found");
      }
      if (updated.received >= updated.chunkCount && !updated.complete) {
        updated.complete = true;
        await updated.save();
      }
      return Response.json({ received: updated.received, complete: updated.complete });
    }
    return Response.json({ received: file.received, complete: file.complete });
  });
}

// DELETE /api/notebook/posts/upload  { id }  — drops an upload no post uses.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE posts/upload", async () => {
    await connectToDB();
    const file = await NotebookPostFile.findOne({ _id: body.data.id, user: auth.userId });
    if (!file) throw apiError(404, "Upload not found");
    const used = await NotebookPost.exists({ user: auth.userId, $or: [{ file: file._id }, { thumb: file._id }] });
    if (used) throw apiError(400, "That upload belongs to a post; delete the post instead");
    await deleteFiles([file._id]);
    return Response.json({ ok: true });
  });
}
