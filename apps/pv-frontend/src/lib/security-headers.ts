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
 * Browsers that honour it ignore host allowlists in `script-src` entirely;
 * `'self'` stays for older browsers that ignore `'strict-dynamic'` instead.
 *
 * ## Google appears in exactly one directive
 *
 * Sign-in used to load Google Identity Services into the page, which needed
 * Google's origin in `script-src`, `style-src-elem`, `connect-src` and
 * `frame-src`. ADR 0011 replaced it with a server-side redirect, so no Google
 * code, stylesheet, frame or fetch touches the browser any more and all four
 * allowances are gone. What remains is `form-action`, because the sign-in form
 * posts to our own route and that route redirects to Google.
 */

export type CspEnvironment = {
  isDevelopment: boolean;
  /** `R2_ENDPOINT`, so a browser upload may reach the bucket it was signed for. */
  r2Endpoint: string | undefined;
  /** `R2_PUBLIC_BASE_URL`, the CDN origin product images resolve to. */
  mediaBaseUrl: string | undefined;
};

/** Google's authorization endpoint, the one off-origin place a form may land. */
const GOOGLE_ORIGIN = "https://accounts.google.com";

/**
 * The style *attributes* `next/image` emits, by hash. There are two, and missing
 * the second took the product page down in production.
 *
 * A plain image gets `color:transparent`, to stop alt text flashing before the
 * file loads. An image with `fill` gets that plus the absolute positioning that
 * makes `fill` work — and without it the picture collapses and the browser
 * reports `<svg> attribute height: Expected length, "auto"` from the placeholder
 * it falls back to.
 *
 * Extracted from rendered HTML rather than guessed: `scripts/verify-routes.mjs`
 * hashes every style attribute on every route it visits and fails the build on
 * one that is not listed here, so a future Next release that changes the
 * declaration is caught before it ships rather than by a customer.
 */
export const NEXT_IMAGE_STYLE_HASHES = [
  // color:transparent
  "sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk=",
  // position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent
  "sha256-ZDrxqUOB4m/L0JWL/+gS52g1CRH0l/qwMhjTw5Z/Fsc=",
] as const;

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

    // `style-src-elem` governs a loaded <link rel="stylesheet"> or a <style>
    // block. It once had to admit accounts.google.com, for a stylesheet the
    // sign-in widget pulled; with the widget gone, nothing off-origin remains.
    ["style-src-elem", "'self'", `'nonce-${nonce}'`],

    // Style *attributes* are governed separately, and a nonce cannot address
    // them. Rather than allow inline styles wholesale — which §5 forbids and
    // which would also permit anything an injection managed to write — this
    // permits exactly the framework's own declarations by hash and nothing
    // else. `'unsafe-hashes'` is what makes a hash apply to an attribute rather
    // than an element; it grants no ability to run script.
    ["style-src-attr", "'unsafe-hashes'", ...NEXT_IMAGE_STYLE_HASHES.map((hash) => `'${hash}'`)],

    // `blob:` is the media picker previewing a file before it is uploaded, and
    // `data:` covers the inline SVG placeholders.
    ["img-src", "'self'", "blob:", "data:", ...(media === null ? [] : [media])],

    // `next/font` self-hosts at build time, so no third-party font origin.
    ["font-src", "'self'"],

    // Uploads go straight from the browser to R2, so its origin is the only
    // one a fetch may reach. There is no `frame-src`: nothing is framed, and
    // omitting it leaves `default-src 'self'` to refuse anything that tries.
    ["connect-src", "'self'", ...uploads],

    ["object-src", "'none'"],
    ["base-uri", "'self'"],

    // `form-action` is checked against every URL in the submission's redirect
    // chain, not just the one on the `action` attribute. The Google button posts
    // to our own start route, which answers 303 to Google — so a bare `'self'`
    // blocked it, and reported the violation against our own URL, which reads
    // like a same-origin post being refused for no reason:
    //
    //   Sending form data to 'https://…/api/v1/auth/google/start' violates the
    //   following Content Security Policy directive: "form-action 'self'"
    //
    // Naming Google here is narrow: it permits a form to end up at Google's
    // authorization endpoint and nowhere else off-origin.
    ["form-action", "'self'", GOOGLE_ORIGIN],
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
 * `Cross-Origin-Opener-Policy` is the full `same-origin`. It was relaxed to
 * `same-origin-allow-popups` for Google's sign-in popup, which needed to talk
 * back to the page that opened it. The redirect flow of ADR 0011 opens no popup,
 * so the exemption bought nothing and is gone.
 */
export function staticSecurityHeaders(isDevelopment: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // `frame-ancestors` above is the modern control; this covers browsers too
    // old to honour it, and costs one header.
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
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
