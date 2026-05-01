/**
 * Next.js Edge Proxy — auth gate
 *
 * Runs before every matched request and checks for the presence of the
 * `auth-token` cookie. If it is missing the user is redirected to /auth.
 *
 * WHY we no longer verify the token against the backend here:
 *   Edge proxy runs in a V8 isolate that cannot reach loopback addresses
 *   (127.0.0.1 / localhost). Any fetch() to the FastAPI backend throws, lands
 *   in the catch block, and the request is let through — making the guard a
 *   no-op. Token validity is instead enforced naturally: every authenticated
 *   API call sends the Bearer token, the backend returns 401 for stale tokens,
 *   and the page-level error handlers redirect to /auth at that point.
 *
 * What this middleware guarantees:
 *   • Unauthenticated browsers (no cookie) are always redirected to /auth.
 *   • Public paths (/auth, /api/*) and Next.js internals are never blocked.
 *   • The `next` query param lets the login page redirect back after sign-in.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that never require authentication
const PUBLIC_PREFIXES = [
  "/auth",   // login / signup page
  "/api/",   // proxied backend calls (auth, forms, etc.)
  "/_next",  // Next.js internals
  "/favicon",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through unconditionally
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // All other routes require the auth cookie
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except Next.js static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};