import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendStaffAccessChangedEmail } from "../src/services/staff-email";

/**
 * The Q11 message, and the line it must not cross.
 *
 * A suspension notice is the one message in the system that is deliberately
 * sent to someone the business has just stopped trusting, and to a mailbox that
 * may no longer be theirs. So the assertions here are mostly about absence: no
 * link back in, no code, nothing that would let the recipient regain access.
 */
const original = { ...process.env };

function sentBody() {
  const call = vi.mocked(global.fetch).mock.calls[0];
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

describe("staff access changed email", () => {
  it("carries the CEO's own words to the suspended staff member", async () => {
    await sendStaffAccessChangedEmail(
      "chidi@test.invalid",
      "Chidi Okonkwo",
      "suspended",
      "We are pausing your access while we look into the stock counts from last week.",
    );

    const body = sentBody();
    expect(body.to).toEqual(["chidi@test.invalid"]);
    expect(body.subject).toBe("Your Pouch Villa staff access has been suspended");
    expect(body.text).toContain("Hello Chidi,");
    expect(body.text).toContain("stock counts from last week");
    expect(body.text).toContain("sessions you had open have ended");
  });

  it("offers no way back in", async () => {
    await sendStaffAccessChangedEmail(
      "chidi@test.invalid",
      "Chidi Okonkwo",
      "suspended",
      "Please call me.",
    );

    const body = sentBody();
    // No sign-in destination and no credential: this reaches a mailbox that may
    // no longer belong to someone the business trusts.
    expect(body.html).not.toMatch(/href="[^"]*\/admin/i);
    expect(body.text.toLowerCase()).not.toContain("/admin/login");
    expect(body.text.toLowerCase()).not.toContain("password");
    expect(body.text).not.toMatch(/\b\d{6}\b/);
  });

  it("says access is restored, without a credential either", async () => {
    await sendStaffAccessChangedEmail(
      "ada@test.invalid",
      "Ada Obi",
      "active",
      "Welcome back — your access is on again from today.",
    );

    const body = sentBody();
    expect(body.subject).toBe("Your Pouch Villa staff access has been restored");
    expect(body.text).toContain("Welcome back");
    expect(body.text).toContain("sign in again as usual");
    expect(body.html).not.toMatch(/href="[^"]*\/admin/i);
  });

  it("sends a usable message when the CEO wrote none", async () => {
    await sendStaffAccessChangedEmail("ada@test.invalid", "Ada Obi", "suspended", null);

    const body = sentBody();
    // The system's own sentence still stands on its own — an empty paragraph
    // where the message would be is not something a recipient should ever see.
    expect(body.text).toContain("suspended");
    expect(body.text.trim()).not.toBe("");
  });

  it("escapes markup typed into the message", async () => {
    await sendStaffAccessChangedEmail(
      "ada@test.invalid",
      "Ada Obi",
      "suspended",
      "<script>alert(1)</script> Call me about this.",
    );

    const body = sentBody();
    // The CEO writes prose, not markup. It is a value in an HTML document like
    // any other, so it is escaped rather than rendered.
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).toContain("&lt;script&gt;");
  });

  it("falls back to no greeting rather than an empty one", async () => {
    await sendStaffAccessChangedEmail("ada@test.invalid", "   ", "suspended", "Call me.");

    const body = sentBody();
    expect(body.text).not.toContain("Hello ,");
  });
});
