import { NextResponse } from "next/server";

// CORS for the API.
// The website calls the API from the same origin and never needs this; the
// mobile and desktop shells run from their own origins and do. Extra origins
// (e.g. a staging shell) can be added with CORS_ALLOWED_ORIGINS="a,b".
const SHELL_ORIGINS = new Set([
  "capacitor://localhost", // iOS shell
  "https://localhost", // Android shell
  "http://localhost", // Android shell when androidScheme is "http"
  "app://pomodrive", // Electron shell
  ...(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, user-id, session-id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function proxy(request) {
  const origin = request.headers.get("origin");
  if (!origin || !SHELL_ORIGINS.has(origin)) return NextResponse.next();

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
