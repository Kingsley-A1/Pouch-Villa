import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryOne = vi.fn();
vi.mock("../src/db/client", () => ({ queryOne }));

const { sendEnquiryAlert, sendEnquiryReceivedEmail } =
  await import("../src/services/contact-email");

/**
 * An enquiry was already being recorded; what was missing was anybody being
 * told. Both halves matter: a customer with no acknowledgement assumes the form
 * is broken and phones instead, and staff with no alert see the message only
 * when they next happen to open the admin.
 */
const original = { ...process.env };

const enquiry = {
  name: "Ada",
  email: "ada@test.invalid",
  phone: null,
  subject: "Does the rugged pouch come in black?",
  message: "I ordered last week and want to know about colours.",
  order_reference: "PV-7Q4K2M",
};

function sentBody(index = 0) {
  const call = vi.mocked(global.fetch).mock.calls[index];
  return JSON.parse(String((call?.[1] as RequestInit).body)) as {
    to: string[];
    subject: string;
    text: string;
  };
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_EMAIL_SEND_FROM = "shop@test.invalid";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as unknown as Response),
  );
});

afterEach(() => {
  process.env = { ...original };
  queryOne.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("enquiry acknowledgement", () => {
  it("quotes the message back, so it is evidence of what arrived", async () => {
    queryOne.mockResolvedValue(enquiry);

    await sendEnquiryReceivedEmail("enquiry-1");

    const body = sentBody();
    expect(body.to).toEqual(["ada@test.invalid"]);
    expect(body.text).toContain("I ordered last week and want to know about colours.");
    expect(body.text).toContain("PV-7Q4K2M");
  });

  /**
   * The service accepts an enquiry with a phone number and no email — one or the
   * other is required, not both — and there is then nobody to write to.
   */
  it("sends nothing when the enquiry left only a phone number", async () => {
    queryOne.mockResolvedValue({ ...enquiry, email: null, phone: "0000000" });

    await sendEnquiryReceivedEmail("enquiry-1");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("enquiry alert", () => {
  it("gives staff enough to answer from a phone without opening the admin", async () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";
    queryOne.mockResolvedValue(enquiry);

    await sendEnquiryAlert("enquiry-1");

    const body = sentBody();
    expect(body.to).toEqual(["ops@test.invalid"]);
    expect(body.text).toContain("Ada");
    expect(body.text).toContain("ada@test.invalid");
    expect(body.text).toContain("I ordered last week and want to know about colours.");
  });

  it("still alerts staff about an enquiry that left only a phone number", async () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";
    queryOne.mockResolvedValue({ ...enquiry, email: null, phone: "0000000" });

    await sendEnquiryAlert("enquiry-1");

    expect(sentBody().to).toEqual(["ops@test.invalid"]);
  });

  it("is skipped, without failing, when no operations inbox is configured", async () => {
    delete process.env.RESEND_EMAIL_SEND_TO;
    queryOne.mockResolvedValue(enquiry);

    await expect(sendEnquiryAlert("enquiry-1")).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
