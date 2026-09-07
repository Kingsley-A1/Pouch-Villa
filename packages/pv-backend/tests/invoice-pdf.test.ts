import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderInvoicePdf, toWinAnsi, type InvoiceDocument } from "../src/documents/invoice-pdf";
import { countFilledRectangles, pdfText } from "./helpers/pdf-text";

/**
 * The invoice layout, which is the one thing in this shop a customer keeps.
 *
 * These assert what a reader would see, not how it was drawn: that the reference
 * is on the page, that a long description cannot push the total off it, and that
 * a product name nobody anticipated does not turn into a customer who cannot
 * download their receipt at all.
 */

function documentFor(overrides: Partial<InvoiceDocument> = {}): InvoiceDocument {
  return {
    title: "Invoice",
    shopName: "Pouch Villa",
    shopLines: [],
    billTo: { heading: "Bill to", name: "Ada Test", lines: ["ada@test.invalid"] },
    meta: [{ label: "Invoice #", value: "PV-7Q4K2-M8XZP" }],
    lines: [{ description: "Rugged Armour Pouch", amount: "10,000.00" }],
    subtotals: [{ label: "Subtotal", amount: "10,000.00" }],
    total: { label: "Total", amount: "10,000.00" },
    terms: { heading: "", lines: [] },
    qr: { payload: "https://test.invalid/orders/PV-7Q4K2-M8XZP", caption: "Scan this" },
    footer: "Powered by Bespoke Invoice",
    ...overrides,
  };
}

describe("renderInvoicePdf", () => {
  it("produces a single-page PDF", async () => {
    const bytes = await renderInvoicePdf(documentFor());

    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    // Read back through a real parser rather than by grepping the bytes: pdf-lib
    // writes page dictionaries into compressed object streams, where no amount
    // of searching the raw file will find them.
    const reopened = await PDFDocument.load(bytes);
    // An invoice that silently spilled onto a second page would put the total
    // somewhere nobody looks.
    expect(reopened.getPageCount()).toBe(1);
  });

  it("draws the reference, the parties and the total", async () => {
    const text = pdfText(await renderInvoicePdf(documentFor()));

    expect(text).toContain("PV-7Q4K2-M8XZP");
    expect(text).toContain("Pouch Villa");
    expect(text).toContain("Ada Test");
    expect(text).toContain("Rugged Armour Pouch");
    expect(text).toContain("10,000.00");
    expect(text).toContain("TOTAL");
  });

  it("credits Bespoke Invoice at the foot of the page", async () => {
    const text = pdfText(await renderInvoicePdf(documentFor()));
    expect(text).toContain("Powered by Bespoke Invoice");
  });

  it("says what currency the amounts are in, in words", async () => {
    // The ₦ on the total is drawn as artwork because no standard PDF font can
    // encode U+20A6. This is the sentence that makes the document unambiguous
    // even where that artwork does not survive a viewer or a photocopier.
    const text = pdfText(await renderInvoicePdf(documentFor()));
    expect(text).toContain("Nigerian Naira (NGN)");
  });

  it("truncates a description rather than letting it grow the row", async () => {
    const long = "Extremely detailed product name ".repeat(20);
    const text = pdfText(
      await renderInvoicePdf(
        documentFor({
          lines: [{ description: long, amount: "10,000.00" }],
        }),
      ),
    );

    expect(text).toContain("…");
    // Two wrapped lines at most, so a pathological name cannot displace the
    // total. The row's own text is what is bounded, not the page.
    const drawn = text.split("\n").filter((line) => line.includes("Extremely detailed"));
    expect(drawn.length).toBeLessThanOrEqual(2);
  });

  it("renders a name a standard font cannot encode instead of throwing", async () => {
    // This is the failure that matters: pdf-lib throws on a character outside
    // WinAnsi, and an unrenderable receipt is worse than an imperfect one.
    const bytes = await renderInvoicePdf(
      documentFor({
        billTo: { heading: "Bill to", name: "日本語 😀 Ada", lines: [] },
        lines: [{ description: "Pouch 😀 日本語", amount: "10,000.00" }],
      }),
    );

    const text = pdfText(bytes);
    expect(text).toContain("Ada");
    expect(text).toContain("Pouch");
  });

  it("draws the QR code as vector modules", async () => {
    const withQr = await renderInvoicePdf(documentFor());
    // Every dark module is its own filled rectangle, so the count runs to the
    // hundreds. A handful would mean the code was never drawn.
    expect(countFilledRectangles(withQr)).toBeGreaterThan(200);
  });

  it("leaves the terms block off entirely when the shop has written none", async () => {
    const text = pdfText(await renderInvoicePdf(documentFor()));
    expect(text).not.toContain("Terms & Conditions");
  });

  it("prints the terms the shop did write", async () => {
    const text = pdfText(
      await renderInvoicePdf(
        documentFor({
          terms: { heading: "Terms & Conditions", lines: ["Payment is due on placement."] },
        }),
      ),
    );

    expect(text).toContain("Terms & Conditions");
    expect(text).toContain("Payment is due on placement.");
  });
});

describe("toWinAnsi", () => {
  it("keeps the Latin text a Nigerian shop actually types", () => {
    expect(toWinAnsi("Pouch Villa — Ada's order")).toBe("Pouch Villa — Ada's order");
  });

  it("spells out the naira sign rather than dropping it", () => {
    // Dropping it would turn "₦5,000 deposit" into "5,000 deposit", which reads
    // as the same claim in a different currency.
    expect(toWinAnsi("₦5,000 deposit")).toBe("NGN5,000 deposit");
  });

  it("drops characters no standard font can draw", () => {
    expect(toWinAnsi("Ada 日本語 😀 Okon")).toBe("Ada  Okon".replace(/\s+/g, " "));
  });

  it("folds a newline into a space so words do not run together", () => {
    expect(toWinAnsi("Line one\nLine two")).toBe("Line one Line two");
  });
});
