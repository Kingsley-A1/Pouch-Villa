import { afterEach, describe, expect, it, vi } from "vitest";

const original = process.env.NEXT_PUBLIC_SITE_INDEXABLE;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_INDEXABLE;
  else process.env.NEXT_PUBLIC_SITE_INDEXABLE = original;
  vi.resetModules();
});

async function rules() {
  vi.resetModules();
  const { default: robots } = await import("@/app/robots");
  const [rule] = [robots().rules].flat();
  return rule!;
}

describe("robots.txt", () => {
  it("keeps crawlers off filter combinations and private pages, and leaves the catalogue open", async () => {
    process.env.NEXT_PUBLIC_SITE_INDEXABLE = "true";
    const rule = await rules();
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(
      expect.arrayContaining([
        "/shop?",
        "/search",
        "/cart",
        "/checkout",
        "/account",
        "/orders",
        "/track",
      ]),
    );
    // `/shop` itself, the products and the clean category pages stay crawlable.
    for (const open of ["/shop", "/products", "/browse"]) expect(rule.disallow).not.toContain(open);
  });

  it("still closes the whole site where indexing is off", async () => {
    process.env.NEXT_PUBLIC_SITE_INDEXABLE = "false";
    expect((await rules()).disallow).toBe("/");
  });
});
