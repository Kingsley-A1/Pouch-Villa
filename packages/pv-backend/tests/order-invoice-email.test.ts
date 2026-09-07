import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryOne = vi.fn();
const query = vi.fn();
const buildOrderDocument = vi.fn();

vi.mock("../src/db/client", () => ({ queryOne, query }));
vi.mock("../src/services/order-documents", () => ({ buildOrderDocument }));

const { sendOrderPlacedEmail } = await import("../src/services/order-email");

/**
 * The invoice travelling with the order confirmation.
 *
 * An attachment is the one delivery that does not depend on the customer still
 * having a session, a signal, or the tab they ordered from. It is also the one
 * that must never cost them the message it rides on — so the interesting case
 * here is not the happy one, it is what happens when the PDF cannot be built.
 */

const original = { ...process.env };

const order = {
  reference: "PV-7Q4K2-M8XZP",
  contact_name: "Ada",
  contact_email: "ada@test.invalid",
  status: "awaiting_payment",
  fulfilment: "delivery",
  total_kobo: "1400000",
  delivery_fee_kobo: "150000",
  subtotal_kobo: "1250000",
};

function sentBody() {
  const call = vi.mocked(global.fetch).mock.calls[0];
  return JSON.parse(String((call?.[1] as RequestInit).body)) as {
    subject: string;
    html: string;
    text: string;
    attachments?: { filename: string; content: string; content_type: string }[];
  };
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_EMAIL_SEND_FROM = "shop@test.invalid";
  queryOne.mockResolvedValue(order);
  query.mockResolvedValue([]);
  buildOrderDocument.mockResolvedValue({
    bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    filename: "Pouch-Villa-Invoice-PV-7Q4K2-M8XZP.pdf",
    contentType: "application/pdf",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as unknown as Response),
  );
});

afterEach(() => {
  process.env = { ...original };
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("sendOrderPlacedEmail", () => {
  it("attaches the invoice as a base64 PDF named after the order", async () => {
    await sendOrderPlacedEmail("order-1");

    const body = sentBody();
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments?.[0]?.filename).toBe("Pouch-Villa-Invoice-PV-7Q4K2-M8XZP.pdf");
    expect(body.attachments?.[0]?.content_type).toBe("application/pdf");
    // Resend takes the bytes base64-encoded, not as an array of numbers.
    expect(Buffer.from(body.attachments?.[0]?.content ?? "", "base64").toString("latin1")).toBe(
      "%PDF",
    );
  });

  it("tells the reader the invoice is attached", async () => {
    await sendOrderPlacedEmail("order-1");
    expect(sentBody().text).toContain("Your invoice is attached");
  });

  it("still sends the confirmation when the invoice cannot be built", async () => {
    buildOrderDocument.mockRejectedValue(new Error("render failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await sendOrderPlacedEmail("order-1");

    // The email carries the items, the total and the transfer details in its
    // own body. Losing the attachment must not lose the message.
    const body = sentBody();
    expect(body.subject).toContain("PV-7Q4K2-M8XZP");
    expect(body.attachments).toBeUndefined();
  });

  it("does not point at an attachment that is not there", async () => {
    buildOrderDocument.mockRejectedValue(new Error("render failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await sendOrderPlacedEmail("order-1");

    // Otherwise the reader goes looking through their mail client for a file
    // that was never sent, and concludes the shop is broken.
    expect(sentBody().text).not.toContain("attached");
  });

  it("keeps the document path out of the log when it fails", async () => {
    buildOrderDocument.mockRejectedValue(new Error("s3://private-bucket/proofs/leaky-key"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendOrderPlacedEmail("order-1");

    // §5: only the error's name reaches a log, never its message.
    expect(JSON.stringify(logged.mock.calls)).not.toContain("private-bucket");
  });

  it("sends nothing at all for an order that does not exist", async () => {
    queryOne.mockResolvedValue(null);

    await sendOrderPlacedEmail("missing");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
