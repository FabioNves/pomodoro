import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NewsTopic from "@/models/NewsTopic";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import {
  listTopics,
  topicDto,
  followTopic,
  setTopicEditions,
  topicNameSchema,
  topicKey,
  SUGGESTED_TOPICS,
} from "@/lib/news/preferences";
import { MAX_EDITIONS } from "@/lib/news/locales";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
// Edition keys the topic is limited to; an empty list means every edition.
const editionKeys = z.array(z.string().trim().min(1).max(40)).max(MAX_EDITIONS);

// GET /api/news/topics
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await connectToDB();
    const topics = await listTopics(auth.userId);
    return Response.json({ topics: topics.map(topicDto), suggested: SUGGESTED_TOPICS });
  } catch (error) {
    console.error("[news] topics GET failed", error);
    return jsonError(500, "Could not load topics");
  }
}

// POST /api/news/topics  { name, source?: "manual" | "story", editions?: string[] }
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      name: topicNameSchema,
      source: z.enum(["manual", "story"]).optional(),
      editions: editionKeys.optional(),
    }),
  );
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const { topic, created } = await followTopic(auth.userId, body.data.name, {
      source: body.data.source || "manual",
      editions: body.data.editions || [],
    });
    return Response.json({ topic: topicDto(topic), created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error?.status === 400) return jsonError(400, error.message);
    console.error("[news] topics POST failed", error);
    return jsonError(500, "Could not follow topic");
  }
}

// PATCH /api/news/topics  { id, editions }
// Which editions a topic is followed in; an empty list means all of them.
export async function PATCH(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId, editions: editionKeys }));
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const topic = await setTopicEditions(auth.userId, body.data.id, body.data.editions);
    return Response.json({ topic: topicDto(topic) });
  } catch (error) {
    if (error?.status === 404) return jsonError(404, "Topic not found");
    console.error("[news] topics PATCH failed", error);
    return jsonError(500, "Could not update the topic");
  }
}

// DELETE /api/news/topics  { id } or { name }
export async function DELETE(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({ id: objectId.optional(), name: topicNameSchema.optional() }).refine((v) => v.id || v.name, {
      message: "id or name is required",
    }),
  );
  if (!body.ok) return body.response;

  try {
    await connectToDB();
    const filter = body.data.id
      ? { _id: body.data.id, user: auth.userId }
      : { key: topicKey(body.data.name), user: auth.userId };
    const removed = await NewsTopic.findOneAndDelete(filter);
    if (!removed) return jsonError(404, "Topic not found");
    return Response.json({ ok: true, id: String(removed._id) });
  } catch (error) {
    console.error("[news] topics DELETE failed", error);
    return jsonError(500, "Could not remove topic");
  }
}
