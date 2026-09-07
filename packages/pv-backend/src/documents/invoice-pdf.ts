import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { INVOICE_LOGO_HEIGHT, INVOICE_LOGO_WIDTH, invoiceLogoPng } from "./logo-asset";
import { isDark, qrMatrix } from "./qr";

/**
 * The one invoice layout, for every document this shop hands out.
 *
 * It knows nothing about orders, payments, settings or the database — it takes a
 * finished description of a page and draws it. That separation is what makes the
 * layout testable without a cluster, and what stops "the payment receipt" and
 * "the order invoice" drifting into two designs that only look like one.
 *
 * The shape follows the reference the client drew: their name top-left, the
 * document type top-right, the mark under it, Bill To against a column of
 * metadata, one bordered table, a total, terms, and a credit line at the foot.
 */

// --- Page geometry ---------------------------------------------------------

/** A4 in points. Nigerian office printing is A4, not Letter. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;

/** The same palette the transactional emails use, so the two look like one shop. */
const INK = rgb(0.09, 0.09, 0.09);
const MUTED = rgb(0.46, 0.43, 0.41);
const LINE = rgb(0.89, 0.86, 0.84);
const BAND = rgb(0.968, 0.953, 0.945);
const BRAND = rgb(0.89, 0.024, 0.075);
const PAPER = rgb(1, 1, 1);

const LOGO_WIDTH = 96;
const LOGO_HEIGHT = (LOGO_WIDTH * INVOICE_LOGO_HEIGHT) / INVOICE_LOGO_WIDTH;

const QR_SIZE = 92;

// --- The document contract -------------------------------------------------

export type InvoiceMetaRow = { label: string; value: string };
export type InvoiceLine = { description: string; amount: string };
export type InvoiceTotal = { label: string; amount: string };

export type InvoiceDocument = {
  /** Top-right heading. The client's reference reads "INVOICE". */
  title: string;
  /** Top-left, and the `alt` the logo stands in for. From settings, never source. */
  shopName: string;
  /** Address, hours — whatever the admin has actually filled in. Often empty. */
  shopLines: readonly string[];
  billTo: { heading: string; name: string; lines: readonly string[] };
  meta: readonly InvoiceMetaRow[];
  lines: readonly InvoiceLine[];
  /** Subtotal, delivery — the rows above the emphasised total. May be empty. */
  subtotals: readonly InvoiceTotal[];
  total: InvoiceTotal;
  /** Drawn beside the QR code. Free text from the shop, or nothing. */
  terms: { heading: string; lines: readonly string[] };
  qr: { payload: string; caption: string };
  /** The credit line at the foot of the page. */
  footer: string;
};

// --- Text that a standard font can actually draw ---------------------------

/**
 * WinAnsi is the encoding every PDF viewer has always had, and the standard
 * fonts are limited to it. A character outside it does not degrade — pdf-lib
 * throws, which would turn one oddly-typed product name into a customer who
 * cannot download their receipt at all.
 *
 * So text is folded into the encoding before it is ever drawn. The common
 * typographic characters that reach here from a product description are mapped
 * to something equivalent; anything genuinely outside Latin is dropped rather
 * than substituted, because a row of question marks reads as a broken document
 * while a missing character reads as a name.
 *
 * The naira sign is mapped rather than dropped: it is the one symbol likely to
 * be typed into a description, and losing it silently would change what an
 * amount appears to say. The total's own ₦ is drawn as artwork — see `drawNaira`.
 */
const SUBSTITUTIONS: ReadonlyMap<string, string> = new Map([
  ["₦", "NGN"], // ₦
  ["→", "->"],
  ["←", "<-"],
  [" ", " "],
  ["⁄", "/"],
]);

/** Latin-1 plus the handful of typographic characters WinAnsi adds at 0x80–0x9F. */
const WIN_ANSI_EXTRAS = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
    0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
    0x0153, 0x017e, 0x0178,
  ].map((point) => String.fromCodePoint(point)),
);

export function toWinAnsi(value: string): string {
  let out = "";
  for (const character of value) {
    const substitute = SUBSTITUTIONS.get(character);
    if (substitute !== undefined) {
      out += substitute;
      continue;
    }
    const point = character.codePointAt(0);
    if (point === undefined) continue;
    // Control characters would draw as boxes or nothing; a tab or newline
    // reaching a single-line cell becomes a space so words do not run together.
    if (point < 0x20) {
      out += point === 0x09 || point === 0x0a || point === 0x0d ? " " : "";
      continue;
    }
    if (point <= 0xff || WIN_ANSI_EXTRAS.has(character)) {
      out += character;
      continue;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

/** One line, cut at the last character that fits, with an ellipsis to say so. */
function truncate(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (widthOf(font, text, size) <= maxWidth) return text;
  const ellipsis = "…";
  let cut = text.length;
  while (cut > 0 && widthOf(font, `${text.slice(0, cut)}${ellipsis}`, size) > maxWidth) {
    cut -= 1;
  }
  return `${text.slice(0, cut).trimEnd()}${ellipsis}`;
}

/**
 * Word wrap to a fixed number of lines, the last of which is truncated.
 *
 * The client's reference calls for a description "kept in a controlled size" —
 * so the cell governs the text rather than the text governing the row, and an
 * unusually long product name cannot push the total off the page.
 */
function wrap(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (widthOf(font, candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current !== "") lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  const remaining = lines.length === maxLines - 1 ? restFrom(words, lines) : current;
  if (remaining !== "") lines.push(truncate(font, remaining, size, maxWidth));
  return lines.slice(0, maxLines);
}

/** Everything the wrapped lines did not consume, so the last line can be cut once. */
function restFrom(words: readonly string[], lines: readonly string[]): string {
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  return words.slice(consumed).join(" ");
}

// --- Drawing helpers -------------------------------------------------------

type Ink = ReturnType<typeof rgb>;

function drawLeft(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; font: PDFFont; size: number; colour: Ink },
): void {
  page.drawText(text, {
    x: options.x,
    y: options.y,
    font: options.font,
    size: options.size,
    color: options.colour,
  });
}

function drawRight(
  page: PDFPage,
  text: string,
  options: { right: number; y: number; font: PDFFont; size: number; colour: Ink },
): void {
  page.drawText(text, {
    x: options.right - widthOf(options.font, text, options.size),
    y: options.y,
    font: options.font,
    size: options.size,
    color: options.colour,
  });
}

function drawRule(page: PDFPage, x: number, y: number, width: number, colour: Ink, height = 0.7) {
  page.drawRectangle({ x, y, width, height, color: colour });
}

/**
 * The naira sign, drawn rather than typed.
 *
 * ₦ is U+20A6 and WinAnsi does not have it, so a standard font cannot set it. The
 * alternatives were to embed a Unicode font — several hundred kilobytes carried
 * by every invoice for one glyph — or to print "NGN", which is correct but is not
 * what the client drew. It is an N with two bars, so it is an N with two bars.
 *
 * Proportions are expressed as fractions of the font size, so it stays aligned
 * with the number beside it at any size.
 */
function drawNaira(
  page: PDFPage,
  options: { x: number; y: number; font: PDFFont; size: number; colour: Ink },
): number {
  const { x, y, font, size, colour } = options;
  page.drawText("N", { x, y, font, size, color: colour });

  const glyphWidth = widthOf(font, "N", size);
  const barWidth = glyphWidth * 1.04;
  const barX = x - glyphWidth * 0.02;
  const thickness = Math.max(0.6, size * 0.075);

  // Set against the cap height rather than the baseline: the bars have to cross
  // the N's own strokes, and the N is what defines where those are.
  for (const fraction of [0.3, 0.47]) {
    page.drawRectangle({
      x: barX,
      y: y + size * fraction,
      width: barWidth,
      height: thickness,
      color: colour,
    });
  }

  return barWidth;
}

/** The QR code, as one filled rectangle per dark module. */
function drawQr(page: PDFPage, payload: string, x: number, y: number, size: number): void {
  const matrix = qrMatrix(payload);
  /**
   * The quiet zone is part of the specification, not decoration: without four
   * clear modules on every side a scanner cannot find the code's edges, and this
   * one sits on a page with a table above it and text beside it.
   */
  const quiet = 4;
  const step = size / (matrix.size + quiet * 2);
  const origin = { x: x + quiet * step, y: y + quiet * step };

  page.drawRectangle({ x, y, width: size, height: size, color: PAPER });

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!isDark(matrix, row, column)) continue;
      page.drawRectangle({
        x: origin.x + column * step,
        // Row 0 is the top of the code; PDF space counts up from the bottom.
        y: origin.y + (matrix.size - 1 - row) * step,
        // A hairline overlap closes the seams that otherwise appear between
        // adjacent modules when a viewer antialiases each rectangle separately —
        // those white lines are exactly what a scanner reads as light modules.
        width: step + 0.12,
        height: step + 0.12,
        color: INK,
      });
    }
  }
}

// --- The document ----------------------------------------------------------

export async function renderInvoicePdf(document: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  pdf.setTitle(toWinAnsi(`${document.title} — ${document.shopName}`));
  pdf.setProducer("Bespoke Invoice");
  pdf.setCreator("Bespoke Invoice");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(invoiceLogoPng);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // The brand rule across the top, the same 5pt band the emails open with.
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 5, width: PAGE_WIDTH, height: 5, color: BRAND });

  const headingBaseline = PAGE_HEIGHT - MARGIN - 18;
  drawLeft(page, toWinAnsi(document.shopName), {
    x: MARGIN,
    y: headingBaseline,
    font: bold,
    size: 20,
    colour: INK,
  });
  drawRight(page, toWinAnsi(document.title.toUpperCase()), {
    right: RIGHT_EDGE,
    y: headingBaseline,
    font: bold,
    size: 20,
    colour: INK,
  });

  let shopLineY = headingBaseline - 15;
  for (const line of document.shopLines.slice(0, 3)) {
    drawLeft(page, truncate(regular, toWinAnsi(line), 8.5, 300), {
      x: MARGIN,
      y: shopLineY,
      font: regular,
      size: 8.5,
      colour: MUTED,
    });
    shopLineY -= 11;
  }

  page.drawImage(logo, {
    x: RIGHT_EDGE - LOGO_WIDTH,
    y: headingBaseline - 12 - LOGO_HEIGHT,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  });

  // --- Bill To, against the metadata column --------------------------------

  const blockTop = Math.min(shopLineY, headingBaseline - 24 - LOGO_HEIGHT) - 22;

  drawLeft(page, toWinAnsi(document.billTo.heading.toUpperCase()), {
    x: MARGIN,
    y: blockTop,
    font: bold,
    size: 8,
    colour: MUTED,
  });
  drawLeft(page, truncate(bold, toWinAnsi(document.billTo.name), 11, 230), {
    x: MARGIN,
    y: blockTop - 16,
    font: bold,
    size: 11,
    colour: INK,
  });

  let billY = blockTop - 30;
  for (const line of document.billTo.lines.slice(0, 4)) {
    drawLeft(page, truncate(regular, toWinAnsi(line), 9, 230), {
      x: MARGIN,
      y: billY,
      font: regular,
      size: 9,
      colour: MUTED,
    });
    billY -= 12;
  }

  let metaY = blockTop;
  const metaValueRight = RIGHT_EDGE;
  // Wide enough for a payment status, not only for a date. At the previous
  // width "Received - being checked" arrived as "Received - being c...", which
  // is the one field on a receipt a reader must not have to guess at.
  const metaValueWidth = 112;
  const metaLabelRight = RIGHT_EDGE - metaValueWidth - 8;
  for (const row of document.meta) {
    drawRight(page, toWinAnsi(row.label), {
      right: metaLabelRight,
      y: metaY,
      font: bold,
      size: 9,
      colour: INK,
    });
    drawRight(page, truncate(regular, toWinAnsi(row.value), 9, metaValueWidth), {
      right: metaValueRight,
      y: metaY,
      font: regular,
      size: 9,
      colour: INK,
    });
    metaY -= 15;
  }

  // --- The table -----------------------------------------------------------

  const tableTop = Math.min(billY, metaY) - 20;
  const tableWidth = RIGHT_EDGE - MARGIN;
  const amountColumnX = RIGHT_EDGE - 128;
  const descriptionWidth = amountColumnX - MARGIN - 24;

  const headerHeight = 24;
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: BAND,
    borderColor: LINE,
    borderWidth: 0.7,
  });
  drawLeft(page, "DESCRIPTION", {
    x: MARGIN + 12,
    y: tableTop - 16,
    font: bold,
    size: 8.5,
    colour: INK,
  });
  drawRight(page, "AMOUNT", {
    right: RIGHT_EDGE - 12,
    y: tableTop - 16,
    font: bold,
    size: 8.5,
    colour: INK,
  });

  let rowTop = tableTop - headerHeight;

  for (const line of document.lines) {
    const wrapped = wrap(regular, toWinAnsi(line.description), 9.5, descriptionWidth, 2);
    const rowHeight = Math.max(30, 16 + wrapped.length * 13);

    page.drawRectangle({
      x: MARGIN,
      y: rowTop - rowHeight,
      width: tableWidth,
      height: rowHeight,
      borderColor: LINE,
      borderWidth: 0.7,
    });

    let textY = rowTop - 18;
    for (const text of wrapped) {
      drawLeft(page, text, { x: MARGIN + 12, y: textY, font: regular, size: 9.5, colour: INK });
      textY -= 13;
    }
    drawRight(page, toWinAnsi(line.amount), {
      right: RIGHT_EDGE - 12,
      y: rowTop - 18,
      font: regular,
      size: 9.5,
      colour: INK,
    });

    rowTop -= rowHeight;
  }

  for (const subtotal of document.subtotals) {
    const rowHeight = 22;
    drawRight(page, toWinAnsi(subtotal.label), {
      right: amountColumnX - 12,
      y: rowTop - 15,
      font: regular,
      size: 9.5,
      colour: MUTED,
    });
    drawRight(page, toWinAnsi(subtotal.amount), {
      right: RIGHT_EDGE - 12,
      y: rowTop - 15,
      font: regular,
      size: 9.5,
      colour: INK,
    });
    rowTop -= rowHeight;
  }

  // --- The total -----------------------------------------------------------

  const totalHeight = 34;
  page.drawRectangle({
    x: amountColumnX,
    y: rowTop - totalHeight,
    width: RIGHT_EDGE - amountColumnX,
    height: totalHeight,
    color: BAND,
    borderColor: LINE,
    borderWidth: 0.7,
  });
  drawRight(page, toWinAnsi(document.total.label.toUpperCase()), {
    right: amountColumnX - 12,
    y: rowTop - 22,
    font: bold,
    size: 12,
    colour: INK,
  });

  const totalAmount = toWinAnsi(document.total.amount);
  const totalSize = 12;
  const amountWidth = widthOf(bold, totalAmount, totalSize);
  const nairaWidth = widthOf(bold, "N", totalSize) * 1.04;
  const gap = 3;
  const nairaX = RIGHT_EDGE - 12 - amountWidth - gap - nairaWidth;
  drawNaira(page, { x: nairaX, y: rowTop - 22, font: bold, size: totalSize, colour: INK });
  drawRight(page, totalAmount, {
    right: RIGHT_EDGE - 12,
    y: rowTop - 22,
    font: bold,
    size: totalSize,
    colour: INK,
  });

  rowTop -= totalHeight;

  /**
   * Said in words as well as drawn as a symbol. The ₦ above is artwork, and a
   * financial document should not rest the reader's understanding of what
   * currency they are being charged in on whether that artwork rendered.
   */
  drawRight(page, "All amounts in Nigerian Naira (NGN)", {
    right: RIGHT_EDGE,
    y: rowTop - 13,
    font: regular,
    size: 7.5,
    colour: MUTED,
  });

  // --- The QR code, the terms, and the credit line -------------------------

  const footerBaseline = MARGIN - 12;
  const footerRuleY = footerBaseline + 16;

  /**
   * The caption sits *above* the code rather than under it.
   *
   * Under it, a caption long enough to say anything useful either ran into the
   * rule above the credit line or had to be cut to one truncated line — and the
   * sentence being cut was the one telling the reader they will be asked for a
   * phone number, which is the difference between a scan that works and a scan
   * that looks broken. Above it there is a whole column's width and no rule to
   * collide with.
   */
  const qrBottom = footerRuleY + 18;
  const termsX = MARGIN + QR_SIZE + 26;
  const captionSize = 7.5;
  // Bounded by where the terms column starts, not by the code's own width: the
  // two share this band, and a caption measured against the QR alone runs
  // straight through the "Terms & Conditions" heading beside it.
  const captionLines = wrap(
    regular,
    toWinAnsi(document.qr.caption),
    captionSize,
    termsX - MARGIN - 14,
    3,
  );
  const blockTopY = qrBottom + QR_SIZE + 8 + (captionLines.length - 1) * 9;

  drawQr(page, document.qr.payload, MARGIN, qrBottom, QR_SIZE);
  for (const [index, caption] of captionLines.entries()) {
    drawLeft(page, caption, {
      x: MARGIN,
      y: blockTopY - index * 9,
      font: regular,
      size: captionSize,
      colour: MUTED,
    });
  }

  const termsWidth = RIGHT_EDGE - termsX;
  let termsY = blockTopY;
  drawLeft(page, toWinAnsi(document.terms.heading), {
    x: termsX,
    y: termsY,
    font: bold,
    size: 9,
    colour: INK,
  });
  termsY -= 14;
  for (const line of document.terms.lines.slice(0, 5)) {
    for (const wrapped of wrap(regular, toWinAnsi(line), 8.5, termsWidth, 2)) {
      drawLeft(page, wrapped, { x: termsX, y: termsY, font: regular, size: 8.5, colour: MUTED });
      termsY -= 11;
    }
  }

  drawRule(page, MARGIN, footerRuleY, RIGHT_EDGE - MARGIN, LINE);
  const footer = toWinAnsi(document.footer);
  drawLeft(page, footer, {
    x: (PAGE_WIDTH - widthOf(regular, footer, 8)) / 2,
    y: footerBaseline,
    font: regular,
    size: 8,
    colour: MUTED,
  });

  return pdf.save();
}
