// Browser-side helper for the Business API. Sends the session token as a
// Bearer header (the business routes verify it) and throws on non-2xx
// responses with the server's message attached. A refused status change
// also carries what is in the way: `error.code === "blocked"` and
// `error.blockers`.
//
// Paths stay relative: inside the app shells src/lib/platform.js redirects
// them to the API server.

export async function businessApi(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    const userId = localStorage.getItem("userId");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userId) headers["user-id"] = userId;
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    // The request never got an answer; "Failed to fetch" tells the user nothing.
    const error = new Error("Could not reach the server. Check your connection and try again.");
    error.status = 0;
    error.code = "network";
    error.blockers = [];
    throw error;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data?.code || null;
    error.details = data?.details || null;
    error.blockers = data?.blockers || [];
    throw error;
  }
  return data;
}
