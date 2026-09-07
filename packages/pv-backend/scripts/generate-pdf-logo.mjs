import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

/**
 * Bakes the client's logo into a source module the PDF renderer can embed.
 *
 * **Why the bytes live in source rather than on disk.** A generated invoice is
 * built inside a serverless function, and a function's filesystem is whatever
 * the bundler decided to trace into it. Reading the logo through `fs` would work
 * locally and then produce a logo-less invoice in production the first time the
 * tracer missed the path — a failure that shows up in a customer's inbox, not in
 * CI. A module import cannot be missed by a bundler.
 *
 * **Why not the URL the emails use.** `email-template.ts` points at
 * `/images/pouch-villa-logo-email.png` because an email client fetches its own
 * images and strips `data:` URIs. A PDF is assembled server-side in one pass, so
 * the equivalent would be the server fetching a file from itself over HTTP,
 * mid-request, to draw a logo it already ships. That is a network round trip and
 * a new failure mode bought for nothing.
 *
 * These are the client's own pixels, cropped — nothing is recoloured or redrawn.
 * The trim finds the artwork from the paper colour, so a re-export with the mark
 * in a different position still comes out right.
 *
 * Run: node packages/pv-backend/scripts/generate-pdf-logo.mjs
 */

const source = resolve(import.meta.dirname, "../../../docs/client/brand/logo-flat-red.jpg");
const output = resolve(import.meta.dirname, "../src/documents/logo-asset.ts");

/**
 * The logo prints about 96pt wide, which is a third of an inch over an inch. At
 * 320px that is roughly 240dpi on paper and sharper than any screen will show
 * it, while keeping the encoded module small enough to read past.
 */
const TARGET_WIDTH = 320;

const png = await sharp(source)
  // A JPEG's white is never exactly 255 across a whole field, so the threshold
  // has to allow for compression noise or the trim finds nothing to remove.
  .trim({ background: "#ffffff", threshold: 12 })
  .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
  // Flattened onto white because a PDF page has no alpha compositing model worth
  // relying on across viewers, and the invoice is white paper anyway.
  .flatten({ background: "#ffffff" })
  // Palette-encoded, and this is where the file size is actually decided: a
  // truecolour PNG of this mark is 78KB and the same image on a 128-entry
  // palette is 13KB, with no visible difference on a logo that is flat red,
  // white and a little shading. Above 128 sharp switches strategy and the file
  // triples again for nothing.
  .png({ compressionLevel: 9, palette: true, colours: 128 })
  .toBuffer();

const { width, height } = await sharp(png).metadata();

/**
 * Wrapped at a width Prettier will not reflow. One 20KB line would technically
 * pass `format:check` and would still be the worst line in the repository.
 */
const CHUNK = 96;
const base64 = png.toString("base64");
const chunks = [];
for (let at = 0; at < base64.length; at += CHUNK) {
  chunks.push(`  "${base64.slice(at, at + CHUNK)}",`);
}

const source_module = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/generate-pdf-logo.mjs from docs/client/brand/logo-flat-red.jpg.
// Re-run that script if the client supplies new artwork.

/** Intrinsic pixel size, so the renderer can scale without distorting it. */
export const INVOICE_LOGO_WIDTH = ${width};
export const INVOICE_LOGO_HEIGHT = ${height};

const ENCODED = [
${chunks.join("\n")}
].join("");

/** The PNG bytes, decoded once per process rather than per document. */
export const invoiceLogoPng: Uint8Array = Uint8Array.from(Buffer.from(ENCODED, "base64"));
`;

writeFileSync(output, source_module, "utf8");

console.log(
  `Wrote ${output}\n  ${width}x${height}px, ${png.length} bytes (${base64.length} base64)`,
);
