/**
 * Builds the 1200x630 link-preview card at src/app/opengraph-image.png.
 *
 * Next.js picks that file up through the opengraph-image file convention and
 * emits the og:image tags, including type and dimensions, automatically.
 *
 * Run with: node scripts/generate-og-image.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const PANEL = 470; // width of the photograph panel on the right
const RED = "#e30613";
const CREAM = "#fcfaf8";
const INK = "#171717";

const escapeXml = (value) =>
  value.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

const headlineOne = "Protect your phone.";
const headlineTwo = "Show your style.";
const subline = "Phone cases matched to your exact model.";

// Stick to fonts that exist on the machine rendering this, with a generic fallback.
const FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif";

const overlay = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CREAM}"/>
  <circle cx="120" cy="60" r="230" fill="${RED}" opacity="0.05"/>

  <rect x="72" y="66" width="60" height="60" rx="16" fill="${RED}"/>
  <text x="102" y="107" font-family="${FONT}" font-size="27" font-weight="800"
        fill="#ffffff" text-anchor="middle">PV</text>
  <text x="150" y="107" font-family="${FONT}" font-size="26" font-weight="800"
        fill="${INK}" letter-spacing="3.5">POUCH VILLA</text>

  <text x="72" y="272" font-family="${FONT}" font-size="66" font-weight="800"
        fill="${INK}" letter-spacing="-2">${escapeXml(headlineOne)}</text>
  <text x="72" y="350" font-family="${FONT}" font-size="66" font-weight="800"
        fill="${RED}" letter-spacing="-2">${escapeXml(headlineTwo)}</text>

  <rect x="72" y="398" width="74" height="5" rx="2.5" fill="${RED}"/>

  <text x="72" y="462" font-family="${FONT}" font-size="27" font-weight="500"
        fill="#5c5654">${escapeXml(subline)}</text>

  <text x="72" y="556" font-family="${FONT}" font-size="22" font-weight="700"
        fill="#8b8481" letter-spacing="1.5">Calabar</text>
</svg>`;

// Rounded panel for the photograph, applied as an alpha mask.
const panelMask = `<svg width="${PANEL}" height="${HEIGHT - 96}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${PANEL}" height="${HEIGHT - 96}" rx="34" fill="#fff"/>
</svg>`;

const photo = await sharp(await readFile("public/images/pouch-villa-hero.png"))
  .resize(PANEL, HEIGHT - 96, { fit: "cover", position: "attention" })
  .composite([{ input: Buffer.from(panelMask), blend: "dest-in" }])
  .png()
  .toBuffer();

const card = await sharp(Buffer.from(overlay))
  .composite([{ input: photo, left: WIDTH - PANEL - 64, top: 48 }])
  .png({ quality: 90, effort: 9, palette: true })
  .toBuffer();

await writeFile("src/app/opengraph-image.png", card);
await writeFile("src/app/twitter-image.png", card);

const { width, height } = await sharp(card).metadata();
console.log(`opengraph-image.png  ${width}x${height}  ${Math.round(card.length / 1024)}KB`);
console.log(`twitter-image.png    ${width}x${height}  ${Math.round(card.length / 1024)}KB`);
