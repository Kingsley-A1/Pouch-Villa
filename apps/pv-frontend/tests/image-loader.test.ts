import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, parse, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DERIVATIVES } from "@pv/backend/storage/image-formats";
import imageLoader, { STATIC_IMAGES, STATIC_WIDTHS, UPLOAD_RENDITIONS } from "@/lib/image-loader";

/**
 * The product page showed broken images because every picture went through
 * Vercel's optimiser, which answers 402 once the plan's allowance is spent. The
 * loader now serves the renditions sharp already built. These pin the choice of
 * rendition, and the two ways it could silently point at a file that does not
 * exist: widths drifting from the upload pipeline, or a bundled photograph with
 * no renditions built.
 */
const hash = "0123456789abcdef0123456789abcdef";
const productHero = `https://media.test/products/p-1/${hash}-hero.webp`;

function load(src: string, width: number) {
  return imageLoader({ src, width, quality: 75 });
}

describe("image loader", () => {
  it("serves the smallest upload rendition that covers the requested width", () => {
    expect(load(productHero, 128)).toBe(`https://media.test/products/p-1/${hash}-thumb.webp`);
    expect(load(productHero, 200)).toBe(`https://media.test/products/p-1/${hash}-thumb.webp`);
    expect(load(productHero, 640)).toBe(`https://media.test/products/p-1/${hash}-card.webp`);
    expect(load(productHero, 1080)).toBe(productHero);
    // Wider than anything built: the widest rendition, never a request to resize.
    expect(load(productHero, 3840)).toBe(productHero);
  });

  it("never routes an image through /_next/image", () => {
    for (const width of [16, 256, 640, 1080, 3840]) {
      expect(load(productHero, width)).not.toContain("/_next/image");
      expect(load("/images/storefront-exterior.jpg", width)).not.toContain("/_next/image");
    }
  });

  it("swaps renditions for category, brand and hero-slide media too", () => {
    for (const owner of ["categories", "brands", "hero"]) {
      const card = `https://media.test/${owner}/o-1/${hash}-card.webp`;
      expect(load(card, 96)).toBe(`https://media.test/${owner}/o-1/${hash}-thumb.webp`);
    }
  });

  it("serves media stored before the rendition pipeline as stored", () => {
    const legacy = "https://media.test/uploads/old-photo.jpg";
    expect(load(legacy, 640)).toBe(legacy);
  });

  it("serves a bundled photograph's built rendition", () => {
    expect(load("/images/pouch-villa-logo-mark.png", 80)).toBe(
      "/images/derived/pouch-villa-logo-mark-160.webp",
    );
    expect(load("/images/storefront-display-wall.jpg", 828)).toBe(
      "/images/derived/storefront-display-wall-1200.webp",
    );
  });

  it("keeps its upload widths in step with the pipeline that writes them", () => {
    expect(UPLOAD_RENDITIONS).toEqual(DERIVATIVES);
  });

  it("lists widths in ascending order, which the lookup depends on", () => {
    const uploadWidths = UPLOAD_RENDITIONS.map((rendition) => rendition.width);
    expect(uploadWidths).toEqual([...uploadWidths].sort((a, b) => a - b));
    expect([...STATIC_WIDTHS]).toEqual([...STATIC_WIDTHS].sort((a, b) => a - b));
  });

  it("has every rendition built for every bundled photograph it serves", () => {
    const missing: string[] = [];
    for (const file of STATIC_IMAGES) {
      for (const width of STATIC_WIDTHS) {
        const built = `public/images/derived/${parse(file).name}-${width}.webp`;
        if (!existsSync(resolve(process.cwd(), built))) missing.push(built);
      }
    }
    expect(missing).toEqual([]);
  });

  it("knows about every bundled photograph a component renders", () => {
    const sourceRoot = resolve(process.cwd(), "src");
    const sourceFiles = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.tsx$/.test(entry.name) ? [path] : [];
      });

    const unlisted: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes('from "next/image"')) continue;
      for (const match of source.matchAll(/src="\/images\/([^"]+)"/g)) {
        const name = match[1];
        if (name !== undefined && !(STATIC_IMAGES as readonly string[]).includes(name)) {
          unlisted.push(`${file}: ${name}`);
        }
      }
    }
    expect(unlisted).toEqual([]);
  });
});
