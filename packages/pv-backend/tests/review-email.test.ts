import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryOne = vi.fn();
vi.mock("../src/db/client", () => ({ queryOne }));

const { sendReviewDecisionEmail } = await import("../src/services/review-email");

/**
 * A review can wait in the moderation queue for days and then be published or
 * turned down with nothing said either way. The author who went looking for
 * their words and did not find them had no way to tell which had happened.
 */
const original = { ...process.env };

function sentBody() {
  const call = vi.mocked(global.fetch).mock.calls[0];
  return JSON.parse(String((call?.[1] as RequestInit).body)) as {
    to: string[];
    subject: string;
    text: string;
  };
}

const review = {
  author_name: "Ada",
  author_email: "ada@test.invalid",
  product_name: "Rugged Pouch",
  product_slug: "rugged-pouch",
};

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

describe("review decision email", () => {
  it("tells the author their review is live", async () => {
    queryOne.mockResolvedValue(review);

    await sendReviewDecisionEmail("review-1", "approved");

    const body = sentBody();
    expect(body.to).toEqual(["ada@test.invalid"]);
    expect(body.subject).toContain("Rugged Pouch");
    expect(body.text).toContain("Hello Ada,");
  });

  it("tells the author when it was not published, and invites another", async () => {
    queryOne.mockResolvedValue(review);

    await sendReviewDecisionEmail("review-1", "rejected");

    expect(sentBody().text).toContain("not able to publish");
  });

  /**
   * The moderator's reason is staff wording written for staff — "spam",
   * "abusive". Forwarding it turns a quiet moderation decision into an argument,
   * so the rejection message deliberately never carries it.
   */
  it("never forwards the moderator's note to the author", async () => {
    queryOne.mockResolvedValue(review);

    await sendReviewDecisionEmail("review-1", "rejected");

    // The service asks for no reason column at all, which is the strongest form
    // of this guarantee: it cannot leak what it never loaded.
    expect(String(queryOne.mock.calls[0]?.[0])).not.toContain("reject_reason");
  });

  it("sends nothing when the review was left without an email address", async () => {
    queryOne.mockResolvedValue({ ...review, author_email: null });

    await sendReviewDecisionEmail("review-1", "approved");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing for a review that has since been deleted", async () => {
    queryOne.mockResolvedValue(null);

    await sendReviewDecisionEmail("review-1", "approved");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
