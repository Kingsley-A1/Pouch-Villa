import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, staticSecurityHeaders } from "@/lib/security-headers";

/**
 * The policy is the kind of thing that gets loosened under deadline, one
 * directive at a time, by somebody chasing a console error at 2am. These tests
 * are the argument against that: each one names what would be given away.
 *
 * They assert the string rather than the browser's behaviour. What the browser
 * then does with it was verified against a real build — every script and style
 * in the rendered page carries the nonce — and that part is the route check's
 * job, not a unit test's.
 */
const ENV = {
  isDevelopment: false,
  r2Endpoint: "https://abc123.r2.cloudflarestorage.com",
  mediaBaseUrl: "https://media.example.test",
};

const GOOGLE_ORIGIN_FOR_TEST = "https://accounts.google.com";

function directive(policy: string, name: string): string {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `) || part === name);
  return found ?? "";
}

describe("content security policy", () => {
  const policy = buildContentSecurityPolicy("test-nonce", ENV);

  it("never allows inline script or style", () => {
    // The single rule AGENTS.md §5 states outright. `'unsafe-hashes'` is a
    // different keyword and is asserted separately below.
    expect(policy).not.toContain("'unsafe-inline'");
  });

  it("does not allow eval outside development", () => {
    expect(policy).not.toContain("'unsafe-eval'");
    const dev = buildContentSecurityPolicy("test-nonce", { ...ENV, isDevelopment: true });
    // React needs it to rebuild server stacks in the browser, and only there.
    expect(dev).toContain("'unsafe-eval'");
  });

  it("trusts scripts by nonce, not by origin", () => {
    const scriptSrc = directive(policy, "script-src");
    expect(scriptSrc).toContain("'nonce-test-nonce'");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("permits exactly one style attribute, by hash", () => {
    const attr = directive(policy, "style-src-attr");
    expect(attr).toContain("'unsafe-hashes'");
    expect(attr).toContain("sha256-");
    // `unsafe-hashes` must never appear where it could apply to script.
    expect(directive(policy, "script-src")).not.toContain("'unsafe-hashes'");
  });

  it("lets a pre-signed upload reach the bucket it was signed for", () => {
    const connect = directive(policy, "connect-src");
    // Virtual-hosted style puts the bucket in a subdomain, so both forms are
    // allowed. Getting this wrong fails every product image upload silently.
    expect(connect).toContain("https://abc123.r2.cloudflarestorage.com");
    expect(connect).toContain("https://*.abc123.r2.cloudflarestorage.com");
  });

  it("allows Google sign-in to load and frame itself", () => {
    expect(directive(policy, "connect-src")).toContain("https://accounts.google.com");
    expect(directive(policy, "frame-src")).toContain("https://accounts.google.com");
  });

  it("lets Google's sign-in button load its own stylesheet", () => {
    // Regression test. Production served a giant unstyled logo and a visible
    // duplicate accessibility label, because style-src-elem was unset and fell
    // back to the nonce-only style-src — which blocked the stylesheet Google's
    // button loads from its own origin to size and hide those elements.
    // Verified against a live Chrome pointed at the deployed policy: the
    // console named accounts.google.com/gsi/style as the blocked request.
    const styleElem = directive(policy, "style-src-elem");
    expect(styleElem).toContain(GOOGLE_ORIGIN_FOR_TEST);
    expect(styleElem).toContain("'nonce-test-nonce'");
    // This directive governs a loaded stylesheet, never a script.
    expect(directive(policy, "script-src")).not.toContain(GOOGLE_ORIGIN_FOR_TEST);
  });

  it("refuses to be framed, and forbids plugins and base tag injection", () => {
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
  });

  it("omits an unconfigured media origin rather than emitting an empty token", () => {
    const bare = buildContentSecurityPolicy("n", {
      isDevelopment: false,
      r2Endpoint: undefined,
      mediaBaseUrl: undefined,
    });
    expect(directive(bare, "img-src")).toBe("img-src 'self' blob: data:");
    expect(directive(bare, "connect-src")).toBe("connect-src 'self' https://accounts.google.com");
  });

  it("upgrades insecure requests only where there is HTTPS to upgrade to", () => {
    expect(policy).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("n", { ...ENV, isDevelopment: true })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("static security headers", () => {
  it("allows the Google sign-in popup to talk back to its opener", () => {
    // `same-origin` severs that and the button fails with nothing useful said.
    expect(staticSecurityHeaders(false)["Cross-Origin-Opener-Policy"]).toBe(
      "same-origin-allow-popups",
    );
  });

  it("sends HSTS in production and never in development", () => {
    expect(staticSecurityHeaders(false)["Strict-Transport-Security"]).toContain("max-age=63072000");
    // Pinning localhost to https in a developer's browser for two years is a
    // very hard thing for them to undo.
    expect(staticSecurityHeaders(true)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("denies the device APIs this shop has no use for", () => {
    const permissions = staticSecurityHeaders(false)["Permissions-Policy"] ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });
});
