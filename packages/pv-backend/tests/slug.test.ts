import { describe, expect, it } from "vitest";
import { MAX_SLUG_LENGTH, firstFreeSlug, slugify } from "../src/domain/slug";

describe("slugify", () => {
  it("lowercases and hyphenates a normal product name", () => {
    expect(slugify("OtterBox Defender Case")).toBe("otterbox-defender-case");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugify("Anker  20W --- USB-C  Charger!!")).toBe("anker-20w-usb-c-charger");
  });

  it("strips diacritics rather than dropping the letter", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(slugify("  ...Blue Pouch...  ")).toBe("blue-pouch");
  });

  it("returns empty for a name with nothing sluggable in it", () => {
    // The caller substitutes a stem; slugify does not invent one.
    expect(slugify("!!!")).toBe("");
    expect(slugify("日本語")).toBe("");
  });

  it("stays within the column width and does not end mid-hyphen", () => {
    const slug = slugify("a".repeat(200));
    expect(slug).toHaveLength(MAX_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("firstFreeSlug", () => {
  it("uses the base when nothing has claimed it", () => {
    expect(firstFreeSlug("blue-pouch", new Set())).toBe("blue-pouch");
  });

  it("suffixes past every taken variant in order", () => {
    const taken = new Set(["blue-pouch", "blue-pouch-2", "blue-pouch-3"]);
    expect(firstFreeSlug("blue-pouch", taken)).toBe("blue-pouch-4");
  });

  it("substitutes a stem when the name yielded nothing", () => {
    expect(firstFreeSlug("", new Set())).toBe("item");
    expect(firstFreeSlug("", new Set(["item"]))).toBe("item-2");
  });

  it("keeps a suffixed slug inside the column width", () => {
    // Trimming the stem rather than the suffix is what keeps this in range;
    // appending to a max-length base would overflow the column.
    const base = "a".repeat(MAX_SLUG_LENGTH);
    const result = firstFreeSlug(base, new Set([base]));
    expect(result.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(result.endsWith("-2")).toBe(true);
  });

  it("does not collide with a name that already ends in a number", () => {
    // "iphone-15" and a second "iphone 15" must not both resolve to the same slug.
    expect(firstFreeSlug("iphone-15", new Set(["iphone-15"]))).toBe("iphone-15-2");
  });
});
