import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

/**
 * Every indexable page names its own address (November 2026).
 *
 * The root layout used to set `alternates.canonical: "/"` and `openGraph.url:
 * "/"`, and Next hands a layout's metadata to every page that does not set its
 * own — so every product, category and policy page told search engines it was
 * a copy of the home page, and every shared link previewed as the home page.
 * These assertions read the metadata Next would use, page by page.
 */

vi.mock("@pv/backend/services/catalogue", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPublishedProductBySlug: async (slug: string) =>
    slug === "red-pouch" ? { slug, name: "Red pouch", description: null } : null,
  getCategoryBySlug: async (slug: string) =>
    slug === "pouches" ? { slug, name: "Pouches" } : null,
  getBrandBySlug: async (slug: string) => (slug === "samsung" ? { slug, name: "Samsung" } : null),
}));

const canonical = (metadata: Metadata) => metadata.alternates?.canonical;

describe("canonical addresses", () => {
  it("the root layout names no address for its pages", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.alternates?.canonical).toBeUndefined();
    expect((metadata.openGraph as { url?: unknown } | undefined)?.url).toBeUndefined();
  });

  it.each([
    ["@/app/(store)/page", "/"],
    ["@/app/(store)/about/page", "/about"],
    ["@/app/(store)/categories/page", "/categories"],
    ["@/app/(store)/contact/page", "/contact"],
    ["@/app/(store)/returns/page", "/returns"],
    ["@/app/(store)/privacy/page", "/privacy"],
    ["@/app/(store)/terms/page", "/terms"],
  ])(
    "%s names itself as %s",
    async (path, expected) => {
      const { metadata } = (await import(/* @vite-ignore */ path)) as { metadata: Metadata };
      expect(canonical(metadata)).toBe(expected);
      // The first page imported pays for transforming the storefront on a cold cache.
    },
    120_000,
  );

  it("a product names its own address", async () => {
    const { generateMetadata } = await import("@/app/(store)/products/[slug]/page");
    const found = await generateMetadata({ params: Promise.resolve({ slug: "red-pouch" }) });
    expect(canonical(found)).toBe("/products/red-pouch");
    const missing = await generateMetadata({ params: Promise.resolve({ slug: "gone" }) });
    expect(canonical(missing)).toBeUndefined();
  });

  it("a category, and a brand within it, name their own addresses", async () => {
    const category = await import("@/app/(store)/browse/[category]/page");
    expect(
      canonical(
        await category.generateMetadata({ params: Promise.resolve({ category: "pouches" }) }),
      ),
    ).toBe("/browse/pouches");
    expect(
      canonical(await category.generateMetadata({ params: Promise.resolve({ category: "gone" }) })),
    ).toBeUndefined();

    const brand = await import("@/app/(store)/browse/[category]/[brand]/page");
    expect(
      canonical(
        await brand.generateMetadata({
          params: Promise.resolve({ category: "pouches", brand: "samsung" }),
        }),
      ),
    ).toBe("/browse/pouches/samsung");
  });

  it("the sitemap lists only routes that exist", async () => {
    const { staticRoutes } = await import("@/lib/seo");
    const paths = staticRoutes.map((route) => route.path);
    for (const gone of ["/collections", "/help", "/visit-us"]) expect(paths).not.toContain(gone);
    expect(paths).toEqual(expect.arrayContaining(["/", "/shop", "/categories", "/about"]));
  });
});
