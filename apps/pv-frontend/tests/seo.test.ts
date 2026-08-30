import { afterEach, describe, expect, it, vi } from "vitest";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  vi.resetModules();
});

describe("site URL configuration", () => {
  it("adds HTTPS when Vercel is configured with a bare custom domain", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "pouchvilla.com.ng";
    vi.resetModules();

    const { absoluteUrl, siteUrl } = await import("@/lib/seo");

    expect(siteUrl).toBe("https://pouchvilla.com.ng");
    expect(absoluteUrl("/shop")).toBe("https://pouchvilla.com.ng/shop");
  });
});
