/**
 * Image rules and format sniffing — everything about images that does *not*
 * need sharp.
 *
 * Split from `images.ts` because that module imports sharp, a native addon that
 * dlopens libvips at module load. Any module that touches one of these
 * constants would otherwise drag the whole binary into its serverless bundle:
 * rendering the product edit screen, which only lists existing media, was
 * failing in production with ERR_DLOPEN_FAILED for exactly that reason.
 *
 * Nothing here reads a byte through a library. The declared MIME type and the
 * file extension are both attacker-controlled, so neither is trusted: the first
 * bytes of the buffer decide what the file is. A `.jpg` that is really an HTML
 * document is exactly how a stored-XSS gets served from a media domain.
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
 *
 * Each width is chosen against the CSS box it actually fills, at 2x device
 * pixels — not 1x, because a browser upscaling a too-small source to cover its
 * box is exactly what "the product images look soft" turns out to mean, and 2x
 * is now the ordinary case rather than the exception (any retina laptop
 * display, most current phones). `next/image` never serves more than the
 * source has: ask it for 960px from a 600px file and it hands back 600px,
 * which the `<img>` element then stretches to fill its box.
 *
 * `card` fills a grid tile at up to 25vw on desktop and up to 100vw on a
 * feature tile's mobile width — at 2x that is up to roughly 900px for a grid
 * tile; a feature tile at 100vw is wide enough that `ProductCard` reaches for
 * `hero` instead rather than pushing `card` to cover it too.
 *
 * `hero` fills the product page's main image at up to 50vw on desktop; at 2x
 * on a 1600px viewport that is 1600px.
 */
export const DERIVATIVES = [
  { name: "thumb", width: 200 },
  { name: "card", width: 960 },
  { name: "hero", width: 1600 },
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
