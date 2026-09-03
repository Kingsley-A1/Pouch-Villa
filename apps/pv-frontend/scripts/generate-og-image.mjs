/**
 * Builds the 1200x630 link-preview card at src/app/opengraph-image.png.
 *
 * Next.js picks that file up through the opengraph-image file convention and
 * emits the og:image tags, including type and dimensions, automatically.
 *
 * Run with: node scripts/generate-og-image.mjs
 *
 * ## The logo is the client's artwork, not a redraw
 *
 * This composites `docs/client/brand/logo-flat-red.jpg` directly. The card used
 * to draw a "PV" lettermark in a red rounded square, which is not the Pouch
 * Villa logo and never was — the real mark is a tilted phone case with a poured
 * fill, locked up with a serif wordmark. A link preview is the one image most
 * people see before they ever reach the site, so it is the last place to show an
 * approximation.
 *
 * `PouchMark` in the app is a faithful *redraw* used where a vector that takes
 * `currentColor` is needed (favicon, header, footer). Here the raster is better:
 * at this size there is resolution to spare, and it carries the real wordmark in
 * the real typeface rather than an interpretation of it.
 *
 * The logo is trimmed of its white margin, then composited with `multiply` so
 * the remaining white ground disappears into the cream card and only the red
 * artwork survives. That needs a light background to work, which is why the
 * card is cream rather than dark.
 *
 * ## Fonts
 *
 * The rendered PNG is committed, so this script runs on one machine and the
 * result is the artifact — it is not rendered per environment. That is what
 * makes a system font stack acceptable here. Regenerating on a machine without
 * these faces will shift the copy's typography, so check the output before
 * committing it.
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;
const PANEL = 452; // width of the photograph panel on the right
const GUTTER = 56;

const RED = "#e30613";
const CREAM = "#fcfaf8";
const INK = "#171717";
const MUTED = "#5c5654";
const LINE = "#eae4e0";

const escapeXml = (value) =>
  value.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

const headlineOne = "Protect your phone.";
const headlineTwo = "Show your style.";
const subline = "Phone cases matched to your exact model.";

/**
 * No location, no phone number, no address. AGENTS.md §4 forbids a business
 * fact in source, and an image generated from source is still source — the
 * previous card had a city name baked into it, which is exactly the kind of
 * thing that goes stale in a file nobody thinks to look in.
 */
const FONT = "Plus Jakarta Sans, Segoe UI, Helvetica Neue, Arial, sans-serif";

const logo = await sharp(await readFile("../../docs/client/brand/logo-flat-red.jpg"))
  // Threshold rather than the default: JPEG artefacts leave the white ground
  // very slightly off-white, and an exact-match trim would keep all of it.
  .trim({ threshold: 20 })
  .resize({ height: 146, fit: "inside" })
  .toBuffer();

const { width: logoWidth, height: logoHeight } = await sharp(logo).metadata();

const panelHeight = HEIGHT - MARGIN * 2 + 36;
const panelTop = (HEIGHT - panelHeight) / 2;
const panelLeft = WIDTH - PANEL - MARGIN + 24;

const textLeft = MARGIN;
const columnRight = panelLeft - GUTTER;

const card = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${RED}" stop-opacity="0.07"/>
      <stop offset="60%" stop-color="${RED}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CREAM}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)"/>

  <!-- A hairline under the wordmark, the width of the text column, to seat the
       lockup rather than leave it floating. -->
  <rect x="${textLeft}" y="${MARGIN + logoHeight + 38}" width="${columnRight - textLeft}"
        height="1" fill="${LINE}"/>

  <text x="${textLeft}" y="352" font-family="${FONT}" font-size="70" font-weight="800"
        fill="${INK}" letter-spacing="-2.4">${escapeXml(headlineOne)}</text>
  <text x="${textLeft}" y="432" font-family="${FONT}" font-size="70" font-weight="800"
        fill="${RED}" letter-spacing="-2.4">${escapeXml(headlineTwo)}</text>

  <rect x="${textLeft}" y="478" width="76" height="5" rx="2.5" fill="${RED}"/>

  <text x="${textLeft}" y="542" font-family="${FONT}" font-size="26" font-weight="500"
        fill="${MUTED}">${escapeXml(subline)}</text>
</svg>`;

// Rounded panel for the photograph, applied as an alpha mask.
const panelMask = `<svg width="${PANEL}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${PANEL}" height="${panelHeight}" rx="30" fill="#fff"/>
</svg>`;

const photo = await sharp(await readFile("public/images/pouch-villa-hero.png"))
  .resize(PANEL, panelHeight, { fit: "cover", position: "attention" })
  .composite([{ input: Buffer.from(panelMask), blend: "dest-in" }])
  .png()
  .toBuffer();

const composed = await sharp(Buffer.from(card))
  .composite([
    // `multiply` drops the logo's white ground into the cream behind it, so the
    // supplied JPEG needs no alpha channel of its own.
    { input: logo, left: textLeft, top: MARGIN, blend: "multiply" },
    { input: photo, left: panelLeft, top: Math.round(panelTop) },
  ])
  .png({ compressionLevel: 9, effort: 9 })
  .toBuffer();

await writeFile("src/app/opengraph-image.png", composed);
await writeFile("src/app/twitter-image.png", composed);

const { width, height } = await sharp(composed).metadata();
console.log(`logo lockup          ${logoWidth}x${logoHeight}`);
console.log(`opengraph-image.png  ${width}x${height}  ${Math.round(composed.length / 1024)}KB`);
console.log(`twitter-image.png    ${width}x${height}  ${Math.round(composed.length / 1024)}KB`);
