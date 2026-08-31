import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  DERIVATIVES,
  MAX_IMAGE_BYTES,
  ImageTooLargeError,
  UnsupportedImageError,
  mediaKey,
  processImage,
  sniffImageFormat,
} from "../src/storage/images";

async function makeJpeg(width = 1600, height = 1200) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

describe("image sniffing", () => {
  it("identifies real formats from their magic bytes", async () => {
    expect(sniffImageFormat(await makeJpeg(8, 8))).toBe("jpeg");
    expect(
      sniffImageFormat(
        await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } })
          .png()
          .toBuffer(),
      ),
    ).toBe("png");
    expect(
      sniffImageFormat(
        await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } })
          .webp()
          .toBuffer(),
      ),
    ).toBe("webp");
  });

  it("rejects a file whose extension lies about its contents", () => {
    // The exact attack the rule exists for: an HTML document named photo.jpg,
    // which would otherwise be stored and served from the media domain.
    const html = Buffer.from("<!doctype html><script>alert(1)</script>", "utf8");
    expect(sniffImageFormat(html)).toBeNull();
  });

  it("rejects an empty or truncated file", () => {
    expect(sniffImageFormat(Buffer.alloc(0))).toBeNull();
    expect(sniffImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("image processing", () => {
  it("refuses a non-image outright", async () => {
    await expect(processImage(Buffer.from("not an image", "utf8"))).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });

  it("refuses a file over the size cap", async () => {
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    // Give it a valid JPEG header so the size check is what rejects it.
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    await expect(processImage(oversized)).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it("records the original's intrinsic dimensions", async () => {
    const processed = await processImage(await makeJpeg(1600, 1200));
    expect(processed.width).toBe(1600);
    expect(processed.height).toBe(1200);
  });

  it("produces every derivative as WebP", async () => {
    const processed = await processImage(await makeJpeg(1600, 1200));
    expect(processed.renditions).toHaveLength(DERIVATIVES.length);
    for (const rendition of processed.renditions) {
      expect(rendition.format).toBe("webp");
      expect(sniffImageFormat(rendition.bytes)).toBe("webp");
    }
  });

  it("never upscales a small source", async () => {
    const processed = await processImage(await makeJpeg(120, 120));
    for (const rendition of processed.renditions) {
      const meta = await sharp(rendition.bytes).metadata();
      expect(meta.width).toBeLessThanOrEqual(120);
    }
  });

  it("strips EXIF, including GPS", async () => {
    // A phone photo of stock in the shop would otherwise carry the shop's
    // coordinates into a publicly served file.
    const withExif = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#123456" },
    })
      .withExif({ IFD0: { Copyright: "Pouch Villa", Software: "test" } })
      .jpeg()
      .toBuffer();

    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const processed = await processImage(withExif);
    for (const rendition of processed.renditions) {
      expect((await sharp(rendition.bytes).metadata()).exif).toBeUndefined();
    }
  });

  it("hashes content, so identical bytes produce identical keys", async () => {
    const bytes = await makeJpeg(300, 300);
    const first = await processImage(bytes);
    const second = await processImage(Buffer.from(bytes));
    expect(first.hash).toBe(second.hash);
    expect(mediaKey("p1", first.hash, "card")).toBe(mediaKey("p1", second.hash, "card"));
  });

  it("scopes keys per product and rendition", async () => {
    const { hash } = await processImage(await makeJpeg(300, 300));
    expect(mediaKey("p1", hash, "thumb")).not.toBe(mediaKey("p2", hash, "thumb"));
    expect(mediaKey("p1", hash, "thumb")).not.toBe(mediaKey("p1", hash, "hero"));
    expect(mediaKey("p1", hash, "card")).toMatch(/^products\/p1\/[0-9a-f]{32}-card\.webp$/);
  });
});
