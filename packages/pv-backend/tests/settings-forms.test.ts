import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_SETTING_FIELDS,
  BANK_SETTING_FIELDS,
  POLICY_SETTING_FIELDS,
  STORE_SETTING_FIELDS,
  announcementSettingsFormSchema,
  policySettingsFormSchema,
  settingsFormSchema,
  storeSettingsFormSchema,
} from "../src/domain/schemas";

/**
 * Regression test for a live defect.
 *
 * `policy.returns` was added to the settings schema and to the admin form, but
 * the Server Action that saved them was never updated to read it. Zod then
 * rejected the submission for a missing required key, so **no policy page could
 * be saved from the admin at all** — the form answered "Check the form." with
 * nothing on it visibly wrong.
 *
 * The fix was structural: the action now reads the same exported field list the
 * schema is written against. These tests hold those two in step, which is the
 * thing that actually broke.
 */

const CASES = [
  ["bank", BANK_SETTING_FIELDS, settingsFormSchema],
  ["store", STORE_SETTING_FIELDS, storeSettingsFormSchema],
  ["policy", POLICY_SETTING_FIELDS, policySettingsFormSchema],
  ["announcement", ANNOUNCEMENT_SETTING_FIELDS, announcementSettingsFormSchema],
] as const;

describe("settings form field lists", () => {
  it.each(CASES)("%s: the field list matches the schema exactly", (_name, fields, schema) => {
    expect([...fields].sort()).toEqual(Object.keys(schema.shape).sort());
  });

  it.each(CASES)("%s: a submission built from the field list is accepted", (_n, fields, schema) => {
    // What the action now sends: every declared field, blank ones included,
    // because clearing a setting has to be expressible.
    const submission = Object.fromEntries(fields.map((field) => [field, ""]));
    const result = schema.safeParse(submission);
    expect(result.success).toBe(true);
  });

  it("rejects a policy submission that omits a field, as the broken action did", () => {
    const withoutReturns = {
      "policy.about": "",
      "policy.privacy": "",
      "policy.terms": "",
    };
    const result = policySettingsFormSchema.safeParse(withoutReturns);
    expect(result.success).toBe(false);
  });
});
