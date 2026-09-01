import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  DERIVATIVES,
  ImageTooLargeError,
  MAX_IMAGE_BYTES,
  UnsupportedImageError,
  sniffImageFormat,
  type ProcessedImage,
} from "./image-formats";

/**
 * Derivative generation. This is the only module in the package that loads
 * sharp, and sharp dlopens libvips the moment it is imported.
 *
 * Everything that merely describes images — the size cap, the derivative
 * widths, magic-byte sniffing — lives in `image-formats.ts` so that reading or
 * listing media never pulls a native binary into a serverless function. Import
 * this module only where an image is actually being processed, and prefer
 * `await import("./images")` at the point of use over a top-level import.
 */

export async function processImage(bytes: Buffer): Promise<ProcessedImage> {
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageTooLargeError(MAX_IMAGE_BYTES);
  if (sniffImageFormat(bytes) === null) throw new UnsupportedImageError();

  const metadata = await sharp(bytes).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new UnsupportedImageError();

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);

  const renditions: ProcessedImage["renditions"] = [];
  for (const derivative of DERIVATIVES) {
    // Never upscale: a 300px source asked to fill a 1400px hero just blurs.
    const targetWidth = Math.min(derivative.width, width);
    renditions.push({
      name: derivative.name,
      format: "webp",
      width: targetWidth,
      bytes: await sharp(bytes)
        .rotate() // Applies the EXIF orientation before that tag is discarded.
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    });
  }

  return { width, height, hash, renditions };
}
