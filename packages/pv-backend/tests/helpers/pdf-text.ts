import { inflateSync } from "node:zlib";

/**
 * Reads the visible text back out of a rendered PDF.
 *
 * Without this a PDF test can only assert that some bytes were produced, which
 * would pass just as happily for a blank page. Getting to the words takes two
 * steps: pdf-lib compresses its content streams with Flate, and then writes each
 * run of text as a hex string operand to `Tj` rather than as readable characters.
 *
 * Deliberately not a PDF parser. It does not resolve fonts, encodings or
 * positions, so it cannot tell you where a word sits or in what order two
 * columns read — only that a string was drawn. That is the right amount of
 * machinery for asserting that a customer's reference reached their invoice, and
 * far less than a real parser would cost to keep working.
 */
export function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const latin1 = buffer.toString("latin1");

  let drawn = "";
  const streamStart = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamStart.exec(latin1)) !== null) {
    const start = match.index + match[0].length;
    const end = latin1.indexOf("endstream", start);
    if (end === -1) continue;

    let inflated: string;
    try {
      inflated = inflateSync(buffer.subarray(start, end)).toString("latin1");
    } catch {
      // Fonts and images are streams too, and are not Flate — or are Flate but
      // are not text. Neither is an error; they simply have nothing to add.
      continue;
    }

    for (const hex of inflated.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      drawn += `${fromWinAnsi(Buffer.from(hex[1] ?? "", "hex"))}\n`;
    }
  }

  return drawn;
}

/**
 * WinAnsi, not Latin-1 — they agree everywhere except 0x80-0x9F, and that range
 * is where the ellipsis lives.
 *
 * Reading those bytes as Latin-1 turns the ellipsis that marks a truncated
 * description into an invisible control character, so a test asserting that a
 * long name *was* cut short fails against a document where it was.
 */
const WIN_ANSI_HIGH: Readonly<Record<number, string>> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

function fromWinAnsi(bytes: Buffer): string {
  let out = "";
  for (const byte of bytes) {
    out += WIN_ANSI_HIGH[byte] ?? String.fromCharCode(byte);
  }
  return out;
}

/** How many filled rectangles the page draws — the QR code is most of them. */
export function countFilledRectangles(bytes: Uint8Array): number {
  const buffer = Buffer.from(bytes);
  const latin1 = buffer.toString("latin1");

  let total = 0;
  const streamStart = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamStart.exec(latin1)) !== null) {
    const start = match.index + match[0].length;
    const end = latin1.indexOf("endstream", start);
    if (end === -1) continue;
    try {
      const inflated = inflateSync(buffer.subarray(start, end)).toString("latin1");
      total += [...inflated.matchAll(/^f$/gm)].length;
    } catch {
      continue;
    }
  }

  return total;
}
