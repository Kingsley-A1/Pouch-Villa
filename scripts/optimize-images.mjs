/**
 * Compresses everything in public/images in place, keeping each file's name and
 * format so no code or seeded database path has to change.
 *
 * Vercel's image optimizer is not available on this deployment (it answers
 * /_next/image with 402), so next.config.ts serves these files unoptimized and
 * straight from /public. That makes the source weight the delivered weight, and
 * these product shots were photographs saved as lossless PNG at 1-2 MB each.
 *
 * Run with: node scripts/optimize-images.mjs
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

const DIRECTORY = "public/images";
const MAX_EDGE = 1200;

function kb(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}

const files = await readdir(DIRECTORY);
let before = 0;
let after = 0;

for (const file of files) {
  const path = join(DIRECTORY, file);
  const original = await readFile(path);
  before += original.length;

  const extension = extname(file).toLowerCase();
  // Read from the buffer, never the live file, so the write cannot race the read.
  let pipeline = sharp(original).resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (extension === ".png") {
    // Palette quantisation is what actually shrinks a photograph stored as PNG.
    pipeline = pipeline.png({ quality: 80, effort: 9, palette: true });
  } else if (extension === ".jpg" || extension === ".jpeg") {
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  } else if (extension === ".webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    after += original.length;
    continue;
  }

  const output = await pipeline.toBuffer();
  // Never let "optimisation" make a file bigger.
  if (output.length < original.length) await writeFile(path, output);
  after += Math.min(output.length, original.length);

  const saved = Math.max(0, Math.round((1 - output.length / original.length) * 100));
  console.log(`${file.padEnd(38)} ${kb(original.length).padStart(8)} -> ${kb(Math.min(output.length, original.length)).padStart(8)}  (-${saved}%)`);
}

const totalSaved = Math.round((1 - after / before) * 100);
console.log(`\nTotal ${kb(before)} -> ${kb(after)} (-${totalSaved}%)`);
await stat(DIRECTORY);
