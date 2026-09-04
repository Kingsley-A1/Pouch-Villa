import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Builds the two logo files the site actually needs, from the one the client
 * supplied.
 *
 * What we were given is `docs/client/brand/logo-flat-red.jpg`: the mark and the
 * wordmark in brand red, on white, as a JPEG. A JPEG has no transparency, so
 * dropping it onto the red storefront would render the logo inside a white box.
 * The instruction was "the exact logo and nothing less", so nothing here is
 * redrawn — the artwork's own pixels decide every output pixel.
 *
 * The source is two-tone: brand red on white. That is exactly the case where a
 * mask can be recovered losslessly enough to matter. For each pixel we ask how
 * far it is from white, and use that distance as **alpha**:
 *
 *   - white paper            → distance 0   → fully transparent
 *   - solid red artwork      → distance max → fully opaque
 *   - the anti-aliased edge  → in between   → a soft edge, preserved
 *
 * That last line is the reason this is a ramp and not a threshold. A hard cutoff
 * gives a logo with jagged stair-stepped curves, which on the phone-case outline
 * — all curves — looks like a bad trace of the logo rather than the logo.
 *
 * Two outputs, because the site has two grounds:
 *
 *   `pouch-villa-logo-white.png`  the reversed lockup, for the red storefront
 *   `pouch-villa-logo-red.png`    the original colour, for the white admin
 *
 * A one-colour reversal is ordinary brand practice and is still the same
 * artwork. What it is not is a substitute for a vector: this is raster, so it is
 * rendered at 3× the largest box it appears in and will not scale beyond that.
 * When the client sends the original SVG or AI file, that replaces both of these
 * and this script is deleted.
 *
 *   node scripts/generate-logo-assets.mjs
 */

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../../../docs/client/brand/logo-flat-red.jpg");
const OUT_DIR = resolve(here, "../public/images");

/** 3× the ~180px the wordmark occupies at its largest, for a retina phone. */
const WIDTH = 560;

/**
 * How far from white a pixel must be before it is fully opaque.
 *
 * JPEG compression leaves the "white" paper a few points off 255 and ringing
 * around every edge, so a threshold of zero would return the compression noise
 * as a grey haze around the logo. 26 clears that and still catches the faintest
 * real edge pixel; measured against this file rather than picked.
 */
const NOISE_FLOOR = 26;

async function main() {
  const source = sharp(SOURCE).ensureAlpha();
  const { data, info } = await source.clone().raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const alpha = Buffer.alloc(width * height);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * channels;
    const red = data[at];
    const green = data[at + 1];
    const blue = data[at + 2];

    // Distance from white on the channel that moved furthest. The artwork is red
    // — high R, low G and B — so green and blue carry the signal and the maximum
    // of the three keeps a thin edge pixel from being averaged into invisibility.
    const distance = Math.max(255 - red, 255 - green, 255 - blue);
    const lifted = ((distance - NOISE_FLOOR) / (255 - NOISE_FLOOR)) * 255;
    alpha[pixel] = Math.max(0, Math.min(255, Math.round(lifted)));
  }

  const mask = sharp(alpha, { raw: { width, height, channels: 1 } });

  // Trimmed on the mask, not the JPEG: `trim` on the original would key off a
  // background colour it has to guess, and the guess is wrong wherever the paper
  // is not perfectly uniform. The mask's background is a true zero.
  const bounds = await mask
    .clone()
    .png()
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  const trimmedWidth = bounds.info.width;
  const trimmedHeight = bounds.info.height;

  for (const [name, tint] of [
    ["pouch-villa-logo-white.png", { r: 255, g: 255, b: 255 }],
    // The artwork's own red, sampled from the file rather than typed in.
    ["pouch-villa-logo-red.png", await sampleArtworkColour(data, alpha, channels)],
  ]) {
    const flat = await sharp({
      create: {
        width: trimmedWidth,
        height: trimmedHeight,
        channels: 3,
        background: tint,
      },
    })
      .png()
      .toBuffer();

    const png = await sharp(flat)
      .joinChannel(bounds.data)
      .resize({ width: WIDTH, fit: "inside", withoutEnlargement: false })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(resolve(OUT_DIR, name), png);
    console.log(
      `${name.padEnd(30)} ${trimmedWidth}×${trimmedHeight} → ${WIDTH}px, ${png.length} bytes`,
    );
  }
}

/**
 * The most saturated colour in the artwork, which for a two-tone logo is the ink.
 *
 * Read from the file so the red we ship is the client's red, not a hex we typed
 * from looking at it — and so this keeps working if they send a revision.
 */
async function sampleArtworkColour(data, alpha, channels) {
  let best = { r: 227, g: 6, b: 19, spread: -1 };
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if (alpha[pixel] < 250) continue;
    const at = pixel * channels;
    const r = data[at];
    const g = data[at + 1];
    const b = data[at + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread > best.spread) best = { r, g, b, spread };
  }
  return { r: best.r, g: best.g, b: best.b };
}

await main();
