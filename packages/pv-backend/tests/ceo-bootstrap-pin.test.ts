import { describe, expect, it } from "vitest";
import { ceoRedemptionIsPinnedOut } from "../src/auth/ceo-bootstrap-pin";

const base = {
  role: "CEO",
  pinnedEmail: "founder@example.test",
  redeemingEmail: "someone-else@example.test",
  ceoExists: false,
};

/**
 * The client's report: the first CEO redeemed fine, the second was refused with
 * a message about the code being expired. The pin was being applied to every
 * CEO code forever rather than only to the bootstrap one.
 *
 * These run without a database, deliberately. The integration test that used to
 * be the only cover for this rule skips wherever DATABASE_URL is unset, which
 * includes CI — so the rule was never actually asserted on any run.
 */
describe("the CEO bootstrap pin", () => {
  it("holds the first CEO to the pinned address while no CEO exists", () => {
    expect(ceoRedemptionIsPinnedOut(base)).toBe(true);
  });

  it("lets the pinned address through", () => {
    expect(ceoRedemptionIsPinnedOut({ ...base, redeemingEmail: base.pinnedEmail })).toBe(false);
  });

  /** The defect. A CEO inviting another CEO must not be refused. */
  it("stands down once a CEO exists, whoever is redeeming", () => {
    expect(ceoRedemptionIsPinnedOut({ ...base, ceoExists: true })).toBe(false);
  });

  it("never applies to a manager or an employee", () => {
    for (const role of ["MANAGER", "STAFF"]) {
      expect(ceoRedemptionIsPinnedOut({ ...base, role })).toBe(false);
    }
  });

  it("does nothing where the deployment configured no pin", () => {
    expect(ceoRedemptionIsPinnedOut({ ...base, pinnedEmail: undefined })).toBe(false);
    expect(ceoRedemptionIsPinnedOut({ ...base, pinnedEmail: "" })).toBe(false);
  });
});
