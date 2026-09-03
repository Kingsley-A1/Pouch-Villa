import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_SESSION_COOKIE, hostPrefixed } from "@pv/backend/auth/cookie-names";
import { buildContentSecurityPolicy, staticSecurityHeaders } from "@/lib/security-headers";

/**
 * Two jobs, both of which have to happen before a page renders.
 *
 * ## 1. Security headers and the Content Security Policy
 *
 * AGENTS.md §5 requires a strict CSP with no `unsafe-inline`, and there was none
 * at all. It is built here rather than in `next.config.ts` because the policy
 * carries a **nonce**, and a nonce must be fresh per request — a value baked
 * into a config file at build time would be a constant an attacker could read
 * off any page and reuse. `lib/security-headers.ts` holds what goes in it.
 *
 * The nonce travels on the request, where Next reads it and attaches it to the
 * scripts it emits, and on the response, in the policy the browser enforces.
 *
 * ## 2. An optimistic redirect for the signed-out customer
 *
 * `/account` is guarded in its layout, which is where the real decision is made.
 * But `(store)/loading.tsx` puts a Suspense boundary above that layout, so by
 * the time the guard resolves Next has already flushed the shell with a 200 and
 * can only finish the redirect on the client. A signed-out visitor therefore got
 * a "Loading" page and a JavaScript redirect rather than an HTTP one — no data
 * leaked, but on a mid-range Android phone with flaky data that is a page that
 * appears to hang.
 *
 * **It is not the authorisation.** It checks only that a session cookie is
 * *present*, never that it is valid: a cookie lookup, no database call, matching
 * Next's own guidance that a proxy is for optimistic checks and "should not be
 * used as a full session management or authorization solution". An expired,
 * revoked or forged cookie gets past this and is rejected by the layout, which
 * verifies it against the session table. The fourth non-negotiable — the server
 * is the security boundary — is unmoved: deleting this file would cost the 307
 * and the headers, and change nothing about who can see an account.
 */

/** Public by design: you must be able to reach these while signed out. */
const PUBLIC_ACCOUNT_PATHS = ["/account/sign-in", "/account/register", "/account/forgot-password"];

function needsCustomerSession(pathname: string): boolean {
  if (!pathname.startsWith("/account")) return false;
  return !PUBLIC_ACCOUNT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDevelopment = process.env.NODE_ENV === "development";

  // `crypto` is the Web Crypto global, available in this runtime without an
  // import; base64 because that is the form a CSP nonce takes.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, {
    isDevelopment,
    r2Endpoint: process.env.R2_ENDPOINT,
    mediaBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  });

  function withSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", csp);
    for (const [name, value] of Object.entries(staticSecurityHeaders(isDevelopment))) {
      response.headers.set(name, value);
    }
    return response;
  }

  if (needsCustomerSession(pathname)) {
    const cookieName = hostPrefixed(CUSTOMER_SESSION_COOKIE, process.env.NODE_ENV === "production");
    if (!request.cookies.has(cookieName)) {
      const signIn = new URL("/account/sign-in", request.url);
      // Carried so signing in returns them to the page they asked for. The
      // sign-in action only honours a same-site path, so this cannot become an
      // open redirect.
      signIn.searchParams.set("next", pathname);
      // Headers go on the redirect too: a 307 is still a response a browser
      // reads, and leaving it bare would be a gap in an otherwise blanket rule.
      return withSecurityHeaders(NextResponse.redirect(signIn, 307));
    }
  }

  /*
    The nonce reaches the renderer on the *request*, two ways, both documented
    by Next and both load-bearing:

      - `Content-Security-Policy`, which Next parses to find `'nonce-…'` and
        stamps onto every script and style it emits. This is the mechanism; a
        response header alone is not what it reads.
      - `x-nonce`, which our own code reads through `headers()` where it writes a
        `<script>` by hand. Next only nonces what Next emits, so the breadcrumb
        JSON-LD has to ask.
  */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    /*
      Everything a browser renders, which is everything except the immutable
      build output. `_next/static` and `_next/image` are served straight from the
      CDN and carry no markup for a policy to protect; running this on them would
      add a per-asset cost for nothing.

      Prefetches are skipped for the same reason Next recommends it: a prefetch
      is not a document render, and minting a nonce for one wastes the work.
    */
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
