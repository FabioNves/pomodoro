import { NextResponse } from "next/server";

export function middleware(request) {
  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    "script-src 'self' https://accounts.google.com/gsi/client https://apis.google.com https://www.gstatic.com; " + // Added accounts.google.com/gsi/client here too for clarity
      "frame-src https://accounts.google.com/gsi/; " + // Allow GSI frames
      "connect-src 'self' https://accounts.google.com/gsi/; " + // Allow connection to GSI endpoints
      "object-src 'none'; " +
      "base-uri 'self'; " + // Good practice
      "form-action 'self';" // Good practice
  );
  // Consider adding style-src 'self' https://accounts.google.com/gsi/ if styles break
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
