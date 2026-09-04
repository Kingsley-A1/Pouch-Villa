import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  NEXT_IMAGE_STYLE_HASHES,
  staticSecurityHeaders,
} from "@/lib/security-headers";

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

  it("permits the framework's own style attributes, by hash, and nothing else", () => {
    const attr = directive(policy, "style-src-attr");
    expect(attr).toContain("'unsafe-hashes'");
    // Both of them. Listing only the first left every `fill` image blocked,
    // which is what took the product page down: the picture collapsed and the
    // browser reported `<svg> attribute height: Expected length, "auto"`.
    for (const hash of NEXT_IMAGE_STYLE_HASHES) expect(attr).toContain(hash);
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

  it("lets a sign-in form end up at Google, and nowhere else off-origin", () => {
    // Regression test. `form-action` is checked against the whole redirect
    // chain, so `'self'` alone blocked a same-origin POST whose 303 pointed at
    // Google — and Chrome reported the violation against our own URL, which
    // reads like nonsense until you know the rule.
    expect(directive(policy, "form-action")).toBe(`form-action 'self' ${GOOGLE_ORIGIN_FOR_TEST}`);
  });

  it("no longer admits Google anywhere a script, style, frame or fetch could come from", () => {
    // ADR 0011 removed the sign-in widget, so these four allowances buy nothing
    // and are gone. Re-adding one means Google code runs in the page again.
    for (const name of ["script-src", "style-src", "style-src-elem", "connect-src", "img-src"]) {
      expect(directive(policy, name)).not.toContain(GOOGLE_ORIGIN_FOR_TEST);
    }
    // Nothing is framed at all, so the directive is absent and `default-src`
    // refuses on its behalf.
    expect(directive(policy, "frame-src")).toBe("");
  });

  it("refuses to be framed, and forbids plugins and base tag injection", () => {
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
  });

  it("omits an unconfigured media origin rather than emitting an empty token", () => {
    const bare = buildContentSecurityPolicy("n", {
      isDevelopment: false,
      r2Endpoint: undefined,
      mediaBaseUrl: undefined,
    });
    expect(directive(bare, "img-src")).toBe("img-src 'self' blob: data:");
    expect(directive(bare, "connect-src")).toBe("connect-src 'self'");
  });

  it("upgrades insecure requests only where there is HTTPS to upgrade to", () => {
    expect(policy).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("n", { ...ENV, isDevelopment: true })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("static security headers", () => {
  it("isolates the page from any opener, with no popup exemption", () => {
    // Relaxed to `same-origin-allow-popups` while Google's sign-in popup needed
    // to talk back to its opener. The redirect flow opens no popup.
    expect(staticSecurityHeaders(false)["Cross-Origin-Opener-Policy"]).toBe("same-origin");
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
