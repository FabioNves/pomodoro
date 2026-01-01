import { NextResponse } from "next/server";

import { NextResponse } from "next/server";

export function middleware(request) {
  const response = NextResponse.next();
  // CSP is now handled in next.config.mjs
  return response;
}

// Define which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

const fetchWithAuth = async (url, options = {}) => {
  const token = await getAccessToken();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return fetch(url, options);
};
