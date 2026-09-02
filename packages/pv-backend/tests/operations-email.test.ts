import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { operationsInbox, sendOperationsEmail } from "../src/services/email";

/**
 * The shop's own inbox — where an enquiry alert and a "proof waiting" alert go
 * when there is no customer to address.
 *
 * The behaviour that matters is what happens when it is *not* configured. A
 * deployment that has not set one must lose the alert, quietly, rather than
 * failing the customer action that triggered it: nobody should be unable to send
 * an enquiry because the shop forgot an environment variable.
 */
const alert = {
  subject: "A payment proof is waiting",
  content: {
    title: "A payment proof is waiting",
    preheader: "One to check.",
    blocks: [{ type: "paragraph", text: "Open Payments in the admin." }],
  },
} as const;

const original = { ...process.env };

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("operationsInbox", () => {
  it("is the configured address", () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";
    expect(operationsInbox()).toBe("ops@test.invalid");
  });

  it("is null when unset or blank, never an empty address", () => {
    delete process.env.RESEND_EMAIL_SEND_TO;
    expect(operationsInbox()).toBeNull();

    process.env.RESEND_EMAIL_SEND_TO = "   ";
    expect(operationsInbox()).toBeNull();
  });
});

describe("sendOperationsEmail", () => {
  it("sends the alert to the configured inbox", async () => {
    process.env.RESEND_EMAIL_SEND_TO = "ops@test.invalid";

    await sendOperationsEmail(alert);

    const call = vi.mocked(global.fetch).mock.calls[0];
    expect(call?.[0]).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String((call?.[1] as RequestInit).body));
    expect(body.to).toEqual(["ops@test.invalid"]);
    expect(body.subject).toBe(alert.subject);
  });

  /**
   * The important one. A shop with no operations inbox loses the alert and
   * nothing else — no throw that a customer's enquiry would surface as an error.
   */
  it("does nothing at all when no inbox is configured", async () => {
    delete process.env.RESEND_EMAIL_SEND_TO;

    await expect(sendOperationsEmail(alert)).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
