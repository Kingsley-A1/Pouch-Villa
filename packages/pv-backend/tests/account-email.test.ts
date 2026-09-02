import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordChangedEmail, sendWelcomeEmail } from "../src/services/account-email";

/**
 * Account mail is the category with the sharpest security rule attached to it:
 * a message about a password must be useful to the owner of the account and
 * useless to somebody who has only got into the mailbox. These assertions hold
 * that line — no code, no password, and no link back in.
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

describe("welcome email", () => {
  it("greets a new member by their first name", async () => {
    await sendWelcomeEmail("ada@test.invalid", "Ada Nnamdi Obi");

    const body = sentBody();
    expect(body.to).toEqual(["ada@test.invalid"]);
    expect(body.text).toContain("Hello Ada,");
  });

  it("still sends when no name was given", async () => {
    await sendWelcomeEmail("ada.obi@test.invalid", null);

    expect(sentBody().text).toContain("Hello ada.obi,");
  });

  /**
   * ADR 0002 removed the inbox round-trip deliberately. A welcome that reads
   * like a verification step reinstates it in the customer's head, which is the
   * expensive half of the thing that was removed.
   */
  it("does not ask anyone to confirm anything", async () => {
    await sendWelcomeEmail("ada@test.invalid", "Ada");

    const body = sentBody();
    expect(body.text).toContain("nothing to confirm");
    expect(body.text.toLowerCase()).not.toContain("verify");
  });
});

describe("password changed email", () => {
  it("tells the owner their password changed and that sessions ended", async () => {
    await sendPasswordChangedEmail("ada@test.invalid", "Ada Obi");

    const body = sentBody();
    expect(body.subject).toContain("password was changed");
    expect(body.text).toContain("signed out");
  });

  /**
   * The whole point of this message is that it reaches the account's owner when
   * the person who changed the password was somebody else. It must therefore
   * hand that somebody nothing: no code to reuse, and no link that signs anyone
   * in.
   */
  it("carries no credential and no way back into the account", async () => {
    await sendPasswordChangedEmail("ada@test.invalid", "Ada Obi");

    const body = sentBody();
    expect(body.html).not.toMatch(/<a\s/i);
    expect(body.text.toLowerCase()).not.toContain("reset code");
    expect(body.text).not.toMatch(/\b\d{6}\b/);
  });
});
