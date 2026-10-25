import { jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { hubNewsConfigured, hubSources } from "@/lib/newsHub/client";

// The hub's catalogue changes rarely; keep each filtered list for a while so
// opening the settings does not call the hub every time.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

/**
 * GET /api/news/sources?country=PT&language=pt&q=
 * The publishers an edition can be limited to or prefer, from the
 * movez-studio news hub. `available` is false when no hub is configured;
 * the settings then hide the source picker.
 */
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!hubNewsConfigured()) return Response.json({ sources: [], available: false });

  const url = new URL(req.url);
  const filter = {
    country: (url.searchParams.get("country") || "").toUpperCase().slice(0, 2),
    language: (url.searchParams.get("language") || "").toLowerCase().slice(0, 5),
    q: (url.searchParams.get("q") || "").slice(0, 80),
  };
  const key = JSON.stringify(filter);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json({ sources: hit.sources, available: true });

  const res = await hubSources(filter);
  if (!res.ok) {
    console.error("[news] hub sources failed", res.error);
    return jsonError(502, "The news sources could not be loaded right now.");
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), sources: res.sources });
  return Response.json({ sources: res.sources, available: true });
}
