import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryOne = vi.fn();
const query = vi.fn();
vi.mock("../src/db/client", () => ({ queryOne, query }));

const { sendProofAwaitingReviewAlert, sendProofReceivedEmail, sendProofRejectedEmail } =
  await import("../src/services/order-email");

/**
 * The payment-proof messages, which close the loop this shop was missing.
 *
 * A buyer who uploads a receipt has already paid and is waiting on a stranger to
 * agree that they did. Before these, an accepted proof was announced and a
 * rejected one was not — the reason staff typed was stored and never delivered,
 * so someone who believed they had paid found out only by reopening the tracking
 * page, or by transferring a second time.
 */
const original = { ...process.env };

const order = {
  reference: "PV-7Q4K2M",
  contact_name: "Ada",
  contact_email: "ada@test.invalid",
  status: "proof_submitted",
  fulfilment: "delivery",
  total_kobo: "1500000",
  delivery_fee_kobo: "100000",
  subtotal_kobo: "1400000",
};

function sentBody(index = 0) {
  const call = vi.mocked(global.fetch).mock.calls[index];
  return JSON.parse(String((call?.[1] as RequestInit).body)) as {
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_EMAIL_SEND_FROM = "shop@test.invalid";
  queryOne.mockResolvedValue(order);
  query.mockResolvedValue([]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as unknown as Response),
  );
});

afterEach(() => {
  process.env = { ...original };
  queryOne.mockReset();
  query.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proof received email", () => {
  it("acknowledges the receipt to the buyer and names their order", async () => {
    await sendProofReceivedEmail("order-1");

    const body = sentBody();
    expect(body.to).toEqual(["ada@test.invalid"]);
    expect(body.subject).toContain("PV-7Q4K2M");
    expect(body.text).toContain("Hello Ada,");
  });

  it("does not claim the payment is confirmed, because it is not yet", async () => {
    await sendProofReceivedEmail("order-1");

    const body = sentBody();
    expect(body.text).toContain("will check it");
    expect(body.subject.toLowerCase()).not.toContain("confirmed");
  });
});

describe("proof rejected email", () => {
  it("delivers the staff reason, which is the whole point of collecting it", async () => {
    await sendProofRejectedEmail("order-1", "The amount does not match the order total.");

    const body = sentBody();
    expect(body.to).toEqual(["ada@test.invalid"]);
    expect(body.text).toContain("The amount does not match the order total.");
  });

  it("says the order is still open, so nobody re-orders or pays twice", async () => {
    await sendProofRejectedEmail("order-1", "Too dark to read.");

    const body = sentBody();
    expect(body.text).toContain("still open");
    expect(body.text).toContain("has not been cancelled");
  });

  /**
   * The order confirmation already carried the transfer details. A rejected
   * proof is not a reason to put an account number into a second mailbox.
   */
  it("does not repeat the bank details", async () => {
    await sendProofRejectedEmail("order-1", "Too dark to read.");

    const body = sentBody();
    expect(body.text).not.toContain("Account number");
    expect(body.text).not.toContain("Bank");
  });
});

describe("proof awaiting review alert", () => {
  it("goes to the shop's operations inbox, not to the buyer", async () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";

    await sendProofAwaitingReviewAlert("order-1");

    const body = sentBody();
    expect(body.to).toEqual(["ops@test.invalid"]);
    expect(body.text).toContain("PV-7Q4K2M");
  });

  /**
   * §5 names payment-proof URLs specifically. The alert says a proof is waiting
   * and where to go and look at it — it never carries the thing itself.
   */
  it("carries no link to the proof", async () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";

    await sendProofAwaitingReviewAlert("order-1");

    expect(sentBody().html).not.toMatch(/<a\s/i);
  });

  it("is skipped, without failing, when no operations inbox is configured", async () => {
    delete process.env.RESEND_EMAIL_SEND_TO;

    await expect(sendProofAwaitingReviewAlert("order-1")).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
