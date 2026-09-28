/**
 * Writes the WebP renditions that `src/lib/image-loader.ts` serves for the
 * photographs in public/images, into public/images/derived.
 *
 * The same job sharp does for every upload, done once for the handful of files
 * that ship with the app, so that no image — uploaded or bundled — needs
 * Vercel's per-request optimiser. The outputs are committed: they are small, and
 * a build that depended on regenerating them would need sharp's native binary on
 * every build host for no benefit.
 *
 * Run after adding or changing a file in public/images that `next/image` renders:
 *   node scripts/build-static-images.mjs
 *
 * The file list and widths must match STATIC_IMAGES and STATIC_WIDTHS in
 * image-loader.ts; tests/image-loader.test.ts fails if a rendition is missing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import sharp from "sharp";

const SOURCE = "public/images";
const TARGET = "public/images/derived";
const FILES = [
  "pouch-villa-logo-mark.png",
  "storefront-display-wall.jpg",
  "storefront-exterior.jpg",
];
const WIDTHS = [160, 640, 1200];

await mkdir(TARGET, { recursive: true });

for (const file of FILES) {
  const original = await readFile(join(SOURCE, file));
  for (const width of WIDTHS) {
    const output = await sharp(original)
      .rotate()
      // Never upscale; a source narrower than the width is written at its own size.
      .resize({ width, withoutEnlargement: true })
      // Quality matches the upload pipeline's, so bundled and uploaded images look alike.
      .webp({ quality: 82 })
      .toBuffer();
    const name = `${parse(file).name}-${width}.webp`;
    await writeFile(join(TARGET, name), output);
    console.log(`${name.padEnd(40)} ${Math.round(output.length / 1024)}KB`);
  }
}
