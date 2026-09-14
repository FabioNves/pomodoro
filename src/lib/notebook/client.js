// Browser-side helper for the notebook API. Sends the session token as a
// Bearer header (the notebook routes verify it) and throws on non-2xx
// responses with the server's error message and details attached.
//
// Paths stay relative: inside the app shells src/lib/platform.js redirects
// them to the API server.

export async function notebookApi(path, { method = "GET", body, signal, keepalive } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    const userId = localStorage.getItem("userId");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userId) headers["user-id"] = userId;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    ...(keepalive ? { keepalive: true } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = data?.details || null;
    throw error;
  }
  return data;
}
