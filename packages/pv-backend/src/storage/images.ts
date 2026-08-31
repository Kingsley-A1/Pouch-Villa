import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Image validation and derivative generation.
 *
 * The declared MIME type and the file extension are both attacker-controlled, so
 * neither is trusted: the first bytes of the buffer decide what the file is. A
 * `.jpg` that is really an HTML document is exactly how a stored-XSS gets served
 * from a media domain.
 */

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file is not a JPEG, PNG, WebP or AVIF image.");
    this.name = "UnsupportedImageError";
  }
}

export class ImageTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`That image is larger than ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    this.name = "ImageTooLargeError";
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

/** Magic-byte signatures. Checked against the buffer, never the declared type. */
export function sniffImageFormat(bytes: Buffer): ImageFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  // Both WebP and AVIF are containers: RIFF....WEBP and ....ftypavif respectively.
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Derivative widths. Generated once on upload rather than per request, so a
 * product page costs no transformation work and every image can be cached
 * immutably.
 */
export const DERIVATIVES = [
  { name: "thumb", width: 200 },
  { name: "card", width: 600 },
  { name: "hero", width: 1400 },
] as const;

export type DerivativeName = (typeof DERIVATIVES)[number]["name"];

export type ProcessedImage = {
  /** Intrinsic dimensions of the original, so every render reserves its box. */
  width: number;
  height: number;
  /** Content hash, so keys are immutable and identical bytes dedupe. */
  hash: string;
  renditions: { name: DerivativeName | "original"; format: "webp"; bytes: Buffer; width: number }[];
};

/**
 * Validates and re-encodes an uploaded image.
 *
 * Re-encoding through sharp is what strips EXIF — including GPS coordinates,
 * which a phone photo of stock in the shop would otherwise carry — and it also
 * means the bytes we serve were produced by our own encoder rather than being
 * an attacker's file passed through untouched.
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

export function mediaKey(productId: string, hash: string, rendition: string) {
  return `products/${productId}/${hash}-${rendition}.webp`;
}
