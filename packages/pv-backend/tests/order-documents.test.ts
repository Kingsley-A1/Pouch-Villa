import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOrderById = vi.fn();
const listProofsForOrder = vi.fn();
const readSettings = vi.fn();
const readSettlement = vi.fn();

vi.mock("../src/services/orders", () => ({ getOrderById }));
vi.mock("../src/services/payments", () => ({ listProofsForOrder }));
vi.mock("../src/services/settings", () => ({ readSettings }));
vi.mock("../src/services/counter-payments", () => ({ readSettlement }));

const { buildOrderDocument } = await import("../src/services/order-documents");
const { pdfText } = await import("./helpers/pdf-text");

/**
 * What actually goes on each of the two documents.
 *
 * The rule these exist to hold is the one about telling the truth: a payment
 * receipt handed to somebody the moment their transfer screenshot lands is a
 * receipt for money nobody has checked yet, and it must not read as though it
 * has been. The rest is what a customer would notice missing.
 */

const original = { ...process.env };

const order = {
  id: "order-1",
  reference: "PV-7Q4K2-M8XZP",
  status: "proof_submitted",
  fulfilment: "delivery",
  paymentTiming: "online",
  preferredPaymentMethod: "bank_transfer",
  preferredPickupAt: null,
  customerId: "customer-1",
  contactName: "Ada Test",
  contactEmail: "ada@test.invalid",
  contactPhone: "+2348012345678",
  deliveryLga: "Eti-Osa",
  deliveryAddress: "12 Somewhere Crescent",
  deliveryLandmark: null,
  subtotalKobo: 1_250_000,
  deliveryFeeKobo: 150_000,
  totalKobo: 1_400_000,
  customerNote: null,
  placedAt: new Date("2026-09-07T10:30:00Z"),
  lines: [
    {
      id: "line-1",
      productName: "Rugged Armour Pouch",
      productSlug: "rugged-armour-pouch",
      variantSku: "PV-RAP-MB-L",
      axes: { colour: "Midnight Black", size: "Large" },
      brandName: "Apple",
      unitPriceKobo: 625_000,
      quantity: 2,
      lineTotalKobo: 1_250_000,
    },
  ],
  timeline: [],
};

function settingsMap(entries: Record<string, string> = {}) {
  return new Map(
    Object.entries(entries).map(([key, value]) => [key, { present: true, value, origin: "admin" }]),
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.test.invalid";
  getOrderById.mockResolvedValue(order);
  listProofsForOrder.mockResolvedValue([]);
  readSettings.mockResolvedValue(settingsMap());
  readSettlement.mockResolvedValue(null);
});

afterEach(() => {
  process.env = { ...original };
  vi.clearAllMocks();
});

describe("the order invoice", () => {
  it("names the order, the buyer and what they bought", async () => {
    const document = await buildOrderDocument("order-1", "invoice");
    const text = pdfText(document!.bytes);

    expect(text).toContain("INVOICE");
    expect(text).toContain("PV-7Q4K2-M8XZP");
    expect(text).toContain("Ada Test");
    expect(text).toContain("Rugged Armour Pouch");
    // The variant is part of the description: a receipt is what somebody holds
    // up when the wrong colour arrives.
    expect(text).toContain("Midnight Black");
    expect(text).toContain("PV-RAP-MB-L");
  });

  it("shows the money at two decimal places", async () => {
    const document = await buildOrderDocument("order-1", "invoice");
    const text = pdfText(document!.bytes);

    expect(text).toContain("12,500.00");
    expect(text).toContain("1,500.00");
    expect(text).toContain("14,000.00");
  });

  it("carries no bank details, even when they are configured", async () => {
    // Offered to the builder deliberately. `DOCUMENT_SETTINGS` does not ask for
    // these keys, so this proves the document does not reach past what it
    // requested rather than merely that the shop has not filled them in.
    readSettings.mockResolvedValue(
      settingsMap({
        "store.address": "12 Example Road",
        "store.contact_email": "shop@test.invalid",
        "bank.account_name": "Pouch Villa Ventures",
        "bank.account_number": "0123456789",
        "bank.bank_name": "Zenith",
      }),
    );

    const document = await buildOrderDocument("order-1", "invoice");
    const text = pdfText(document!.bytes);

    /*
      §5, and the same reasoning that keeps them out of the proof-rejected
      email: the transfer details belong in the message the customer pays from,
      not in a PDF that forwards more easily than it does.

      The assertion is on the details themselves, not on the word "bank". It
      used to be the word, which was a cheap proxy that also forbade the invoice
      from naming *how* the order is to be settled — and "Bank transfer" as a
      payment method carries no account, no sort code and no holder. Nothing a
      customer could pay into leaks from a channel name.
    */
    expect(text).not.toContain("0123456789");
    expect(text).not.toContain("Pouch Villa Ventures");
    expect(text).not.toContain("Zenith");
    expect(text).not.toMatch(/account/i);
  });

  it("names the file after the order, never after an id", async () => {
    const document = await buildOrderDocument("order-1", "invoice");

    expect(document!.filename).toBe("Pouch-Villa-Invoice-PV-7Q4K2-M8XZP.pdf");
    expect(document!.contentType).toBe("application/pdf");
  });

  it("omits an unset shop address rather than leaving a gap", async () => {
    const document = await buildOrderDocument("order-1", "invoice");
    const text = pdfText(document!.bytes);

    expect(text).toContain("Pouch Villa");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });
});

describe("the payment receipt", () => {
  it("does not claim money has been received before anyone has checked", async () => {
    listProofsForOrder.mockResolvedValue([
      { id: "proof-1", status: "pending", uploadedAt: new Date("2026-09-07T11:00:00Z") },
    ]);

    const document = await buildOrderDocument("order-1", "receipt");
    const text = pdfText(document!.bytes);

    expect(text).toContain("Under review");
    expect(text).toContain("TOTAL DUE");
    expect(text).not.toContain("TOTAL PAID");
  });

  it("reads as paid once the order has moved past payment", async () => {
    getOrderById.mockResolvedValue({ ...order, status: "preparing" });
    listProofsForOrder.mockResolvedValue([
      { id: "proof-1", status: "accepted", uploadedAt: new Date("2026-09-07T11:00:00Z") },
    ]);

    const document = await buildOrderDocument("order-1", "receipt");
    const text = pdfText(document!.bytes);

    expect(text).toContain("Confirmed");
    expect(text).toContain("TOTAL PAID");
  });

  it("says a cancelled order is cancelled", async () => {
    getOrderById.mockResolvedValue({ ...order, status: "cancelled" });

    const document = await buildOrderDocument("order-1", "receipt");
    const text = pdfText(document!.bytes);

    expect(text).toContain("Order cancelled");
    expect(text).not.toContain("TOTAL PAID");
  });

  it("is named as a receipt, not as an invoice", async () => {
    const document = await buildOrderDocument("order-1", "receipt");

    expect(document!.filename).toBe("Pouch-Villa-Payment-receipt-PV-7Q4K2-M8XZP.pdf");
    expect(pdfText(document!.bytes)).toContain("PAYMENT RECEIPT");
  });
});

describe("the terms block", () => {
  it("prints nothing where the shop has written nothing", async () => {
    const text = pdfText((await buildOrderDocument("order-1", "invoice"))!.bytes);
    expect(text).not.toContain("Terms & Conditions");
  });

  it("prints what the admin typed", async () => {
    readSettings.mockResolvedValue(
      settingsMap({ "store.invoice_terms": "Payment is due when the order is placed." }),
    );

    const text = pdfText((await buildOrderDocument("order-1", "invoice"))!.bytes);
    expect(text).toContain("Payment is due when the order is placed.");
  });
});

describe("a missing order", () => {
  it("produces nothing rather than a blank invoice", async () => {
    getOrderById.mockResolvedValue(null);
    await expect(buildOrderDocument("nope", "invoice")).resolves.toBeNull();
  });
});

/**
 * The client asked the invoice to say how the order is paid for. Two documents,
 * two different truths: the invoice states the arrangement because it is raised
 * before any money moves, and the receipt states what actually arrived.
 */
describe("payment method on the documents", () => {
  it("states the arrangement on the invoice", async () => {
    const built = await buildOrderDocument("order-1", "invoice");
    const text = await pdfText(built!.bytes);
    expect(text).toContain("Payment method");
    expect(text).toContain("Bank transfer");
  });

  it("says cash on collection where that is what was arranged", async () => {
    getOrderById.mockResolvedValue({
      ...order,
      fulfilment: "pickup",
      paymentTiming: "on_collection",
      preferredPaymentMethod: "cash",
    });

    const text = await pdfText((await buildOrderDocument("order-1", "invoice"))!.bytes);
    expect(text).toContain("Cash on collection");
  });

  it("names the POS without calling it a transfer", async () => {
    getOrderById.mockResolvedValue({
      ...order,
      fulfilment: "pickup",
      paymentTiming: "on_collection",
      preferredPaymentMethod: "pos_card",
    });

    const text = await pdfText((await buildOrderDocument("order-1", "invoice"))!.bytes);
    expect(text).toContain("Card (POS) on collection");
    expect(text).not.toContain("Bank transfer");
  });

  it("records what the money actually arrived as on a settled receipt", async () => {
    getOrderById.mockResolvedValue({ ...order, status: "payment_confirmed" });
    readSettlement.mockResolvedValue({ method: "cash", timing: "on_collection", note: null });

    const text = await pdfText((await buildOrderDocument("order-1", "receipt"))!.bytes);
    expect(text).toContain("Paid with");
    expect(text).toContain("Cash");
  });

  it("will not claim a method on a receipt for money that has not arrived", async () => {
    // Cash was arranged, but nobody has walked in yet. The receipt may say what
    // is expected; it may not say the shop was paid in cash.
    getOrderById.mockResolvedValue({
      ...order,
      status: "awaiting_payment",
      fulfilment: "pickup",
      paymentTiming: "on_collection",
      preferredPaymentMethod: "cash",
    });
    readSettlement.mockResolvedValue(null);

    const text = await pdfText((await buildOrderDocument("order-1", "receipt"))!.bytes);
    expect(text).toContain("Method expected");
    expect(text).not.toContain("Paid with");
  });
});
