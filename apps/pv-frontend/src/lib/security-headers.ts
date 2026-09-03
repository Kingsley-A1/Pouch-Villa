/**
 * The response headers every request carries, and the Content Security Policy
 * that AGENTS.md §5 requires: "Security headers including a strict CSP. No
 * `unsafe-inline`."
 *
 * There was none at all before this. A storefront that renders staff-authored
 * policy text and customer-authored reviews is exactly the shape of application
 * a CSP exists for: it is the layer that still holds when some other escaping
 * fails.
 *
 * ## No `unsafe-inline`, anywhere
 *
 * Next needs its hydration scripts to run, so the policy trusts them by
 * **nonce** rather than by opening inline execution to everything. The proxy
 * mints one per request and Next attaches it to its own scripts and styles
 * automatically. Two things in this codebase had to change to make that
 * possible, and both are worth knowing about before adding a third:
 *
 *   - `ProgressiveDisclosure` set `grid-template-rows` through a `style`
 *     attribute. A style *attribute* is covered by `style-src-attr`, which a
 *     nonce cannot address — allowing it means `unsafe-inline`. It uses classes.
 *   - The breadcrumb JSON-LD is a hand-written `<script>`, so it asks for the
 *     nonce itself. Next only nonces what Next emits.
 *
 * `'strict-dynamic'` means a script this policy already trusts may load others.
 * That is what lets Google's sign-in client load: `next/script` injects it from
 * an already-trusted bundle. Browsers that honour `strict-dynamic` ignore host
 * allowlists in `script-src`, so listing Google there would achieve nothing;
 * `'self'` stays for older browsers that ignore `strict-dynamic` instead.
 */

export type CspEnvironment = {
  isDevelopment: boolean;
  /** `R2_ENDPOINT`, so a browser upload may reach the bucket it was signed for. */
  r2Endpoint: string | undefined;
  /** `R2_PUBLIC_BASE_URL`, the CDN origin product images resolve to. */
  mediaBaseUrl: string | undefined;
};

/** Google Identity Services: the script, its iframe, and the calls it makes. */
const GOOGLE_ORIGIN = "https://accounts.google.com";

/**
 * SHA-256 of `color:transparent`, the one style attribute `next/image` emits.
 * Verified against the built output rather than assumed — see `style-src-attr`.
 */
const NEXT_IMAGE_STYLE_HASH = "sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk=";

function originOf(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * Where a pre-signed upload actually goes.
 *
 * The S3 client is virtual-hosted by default, so the bucket becomes a subdomain
 * of the configured endpoint. Both forms are allowed because which one a
 * pre-signed URL takes depends on client configuration, and a `connect-src` that
 * is wrong here does not warn — it silently fails every product image upload.
 */
function uploadOrigins(endpoint: string | undefined): string[] {
  const origin = originOf(endpoint);
  if (origin === null) return [];
  const { protocol, host } = new URL(origin);
  return [origin, `${protocol}//*.${host}`];
}

export function buildContentSecurityPolicy(nonce: string, env: CspEnvironment): string {
  const media = originOf(env.mediaBaseUrl);
  const uploads = uploadOrigins(env.r2Endpoint);

  const directives: string[][] = [
    ["default-src", "'self'"],

    // React uses `eval` in development to rebuild server stacks in the browser.
    // It does not in production, and this must never grant it there.
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(env.isDevelopment ? ["'unsafe-eval'"] : []),
    ],

    // Stylesheets are same-origin files; Next's own inline styles carry the
    // nonce. No `unsafe-inline`, which is the whole point.
    ["style-src", "'self'", `'nonce-${nonce}'`],

    // `style-src-elem` governs a loaded <link rel="stylesheet"> or <style>
    // block, and falls back to `style-src` above when unset — which is exactly
    // what broke Google's sign-in button in production: it loads its own
    // stylesheet from accounts.google.com/gsi/style to size the logo and hide a
    // duplicate accessibility label, that request was blocked outright, and
    // without it the raw SVG rendered at full size next to visible fallback
    // text. Verified against a live Chrome pointed at the deployed policy, not
    // assumed: the console named the exact blocked URL.
    ["style-src-elem", "'self'", `'nonce-${nonce}'`, GOOGLE_ORIGIN],

    // Style *attributes* are governed separately, and a nonce cannot address
    // them. `next/image` puts `style="color:transparent"` on every image it
    // renders, to stop alt text flashing before the file loads. That is one
    // declaration, from the framework, on markup we do not write.
    //
    // Rather than allow inline styles wholesale — which §5 forbids and which
    // would also permit anything an injection managed to write — this permits
    // exactly that string by hash and nothing else. `'unsafe-hashes'` is what
    // makes a hash apply to an attribute rather than an element; it grants no
    // ability to run script.
    //
    // If a future Next release changes the declaration, images lose a cosmetic
    // rule and the browser console names the hash it wanted. Nothing breaks.
    ["style-src-attr", "'unsafe-hashes'", `'${NEXT_IMAGE_STYLE_HASH}'`],

    // `blob:` is the media picker previewing a file before it is uploaded, and
    // `data:` covers the inline SVG placeholders.
    ["img-src", "'self'", "blob:", "data:", ...(media === null ? [] : [media])],

    // `next/font` self-hosts at build time, so no third-party font origin.
    ["font-src", "'self'"],

    ["connect-src", "'self'", GOOGLE_ORIGIN, ...uploads],
    ["frame-src", GOOGLE_ORIGIN],

    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];

  // Only in production. Over plain http in development it would upgrade every
  // local request to https and nothing would load.
  if (!env.isDevelopment) directives.push(["upgrade-insecure-requests"]);

  return directives.map((parts) => parts.join(" ")).join("; ");
}

/**
 * The headers that do not depend on the request.
 *
 * `Cross-Origin-Opener-Policy` is `same-origin-allow-popups`, not `same-origin`.
 * Google sign-in opens a popup and talks back to the opener; the stricter value
 * severs that and the button fails with nothing useful said. The weaker value
 * still isolates this page from any other site that opens it.
 */
export function staticSecurityHeaders(isDevelopment: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // `frame-ancestors` above is the modern control; this covers browsers too
    // old to honour it, and costs one header.
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    // Nothing in this shop uses a camera, a microphone, location or the Payment
    // Request API. Denying them means a future dependency cannot start.
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    // Two years, subdomains included. Sent only over HTTPS: a browser ignores it
    // on http, and setting it in development would pin localhost to https in the
    // developer's browser for two years.
    ...(isDevelopment
      ? {}
      : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }),
  };
}
