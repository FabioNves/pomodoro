import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookPostFile from "@/models/NotebookPostFile";
import { validateSearchParams } from "@/utils/apiValidation";
import { objectId, run, apiError } from "@/lib/notebook/server";
import { verifyMediaUrl, byteRange, fileStream } from "@/lib/notebook/postsServer";

// Streams a saved post's media. <img> and <video> tags cannot send the
// session header, so instead the URL carries a signature minted by the
// posts routes (mediaUrl()); nothing unsigned or expired is served.
// Byte ranges are honoured so videos can seek.

export const maxDuration = 120;

const query = z.object({
  id: objectId,
  u: z.string().trim().min(1).max(256),
  exp: z.coerce.number().int(),
  sig: z.string().min(10).max(200),
});

async function open(req) {
  const parsed = validateSearchParams(req, query);
  if (!parsed.ok) throw apiError(400, "Invalid media URL");
  const { id, u, exp, sig } = parsed.data;
  if (!verifyMediaUrl(u, id, exp, sig)) throw apiError(403, "This media link has expired");
  await connectToDB();
  // The owner is part of the signature, and checked again here: a link can
  // only ever fetch the file of the user it was minted for.
  const file = await NotebookPostFile.findOne({ _id: id, user: u, complete: true });
  if (!file) throw apiError(404, "File not found");
  return file;
}

function baseHeaders(file) {
  const name = (file.name || "file").replace(/["\r\n]/g, "");
  return {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=259200",
    "Content-Disposition": `inline; filename="${name}"`,
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(req) {
  return run("GET posts/file", async () => {
    const file = await open(req);
    let range;
    try {
      range = byteRange(req.headers.get("range"), file.size);
    } catch (error) {
      if (error?.status !== 416) throw error;
      // RFC 7233: a 416 says how long the file actually is.
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${file.size}`, "Accept-Ranges": "bytes" },
      });
    }
    const span = range || { start: 0, end: file.size - 1 };
    const headers = {
      ...baseHeaders(file),
      "Content-Length": String(span.end - span.start + 1),
      ...(range ? { "Content-Range": `bytes ${span.start}-${span.end}/${file.size}` } : {}),
    };
    return new Response(fileStream(file, span), { status: range ? 206 : 200, headers });
  });
}

export async function HEAD(req) {
  return run("HEAD posts/file", async () => {
    const file = await open(req);
    return new Response(null, {
      status: 200,
      headers: { ...baseHeaders(file), "Content-Length": String(file.size) },
    });
  });
}
