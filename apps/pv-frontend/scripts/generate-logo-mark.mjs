import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import sharp from "sharp";

/**
 * Crops the client's supplied logo down to its own artwork.
 *
 * `docs/client/brand/logo-flat-red.jpg` is a 1080x1080 square whose mark
 * occupies a little over half the width and 41% of the height; the rest is
 * empty white paper. Rendered whole in a 44px header badge, the mark itself came
 * out around 20px tall, so the component scaled the image to 195% and offset it
 * to crop the margin away in CSS. That is what made the header logo look soft:
 * `next/image` sized the file for the box, and the browser then blew it up.
 *
 * Cropping it here instead means the served file *is* the mark, at its full
 * supplied resolution, with no upscale anywhere. Nothing is recoloured, redrawn
 * or regenerated — these are the client's own pixels with the blank margin
 * removed, which is why this is a crop and not a trace.
 *
 * `trim()` finds the bounding box from the paper colour rather than from
 * numbers typed in here, so it stays correct if the client sends a re-export
 * with the mark in a different position.
 *
 * PNG out, not JPEG: re-encoding a JPEG at a crop boundary adds ringing around
 * hard red-on-white edges, which is the one artefact a logo cannot afford.
 *
 * Run: node apps/pv-frontend/scripts/generate-logo-mark.mjs
 */

const source = resolve(import.meta.dirname, "../../../docs/client/brand/logo-flat-red.jpg");
const output = resolve(import.meta.dirname, "../public/images/pouch-villa-logo-mark.png");

mkdirSync(dirname(output), { recursive: true });

const before = await sharp(source).metadata();

const info = await sharp(source)
  // A JPEG's white is never exactly 255 across a whole field, so the threshold
  // has to allow for compression noise or the trim finds nothing to remove.
  .trim({ background: "#ffffff", threshold: 12 })
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(`in   ${before.width}x${before.height}  ${source}`);
console.log(`out  ${info.width}x${info.height}  ${output}`);
console.log(
  `\nThe mark now fills the file, so the header renders it at 1:1 or better ` +
    `instead of upscaling a ${Math.round((info.width / before.width) * 100)}% crop.`,
);
