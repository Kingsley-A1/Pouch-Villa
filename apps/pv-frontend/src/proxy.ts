import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_SESSION_COOKIE, hostPrefixed } from "@pv/backend/auth/cookie-names";

/**
 * An optimistic redirect for the signed-out customer, and nothing more.
 *
 * ## Why this exists
 *
 * `/account` is guarded in its layout, which is where the real decision is made.
 * But `(store)/loading.tsx` puts a Suspense boundary above that layout, so by
 * the time the guard resolves Next has already flushed the shell with a 200 and
 * can only finish the redirect on the client. A signed-out visitor therefore got
 * a "Loading" page and a JavaScript redirect rather than an HTTP one — no data
 * leaked, but on a mid-range Android phone with flaky data that is a page that
 * appears to hang. This turns the common case back into a real 307.
 *
 * ## Why it is not the authorisation
 *
 * It checks only that a session cookie is *present*, never that it is valid — a
 * cookie lookup, no database call, matching Next's own guidance that a proxy is
 * for optimistic checks and "should not be used as a full session management or
 * authorization solution". An expired, revoked or forged cookie gets past this
 * and is then rejected by the layout, which verifies it server-side against the
 * session table. AGENTS.md §5 holds: the server is the security boundary, and
 * this is a redirect, not a permission.
 *
 * Deleting this file would cost the 307 and change nothing about who can see an
 * account.
 */

/** Public by design: you must be able to reach these while signed out. */
const PUBLIC_ACCOUNT_PATHS = ["/account/sign-in", "/account/register", "/account/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ACCOUNT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const cookieName = hostPrefixed(CUSTOMER_SESSION_COOKIE, process.env.NODE_ENV === "production");
  if (request.cookies.has(cookieName)) return NextResponse.next();

  const signIn = new URL("/account/sign-in", request.url);
  // Carried so signing in returns them to the page they asked for. The sign-in
  // action only honours a same-site path, so this cannot become an open redirect.
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn, 307);
}

export const config = {
  matcher: "/account/:path*",
};
