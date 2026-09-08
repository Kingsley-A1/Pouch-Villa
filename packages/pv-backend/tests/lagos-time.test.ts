import { describe, expect, it } from "vitest";
import { lagosLocalToInstant } from "../src/domain/lagos-time";

/**
 * The bug this exists to prevent is silent: a slot an hour out looks like a slot,
 * and only the customer standing in an empty shop finds out.
 */
const NOW = new Date("2026-09-08T09:00:00Z");

describe("lagosLocalToInstant", () => {
  it("reads a wall-clock time as Lagos, not as the server's timezone", () => {
    // 14:30 in Lagos is 13:30 UTC, whatever the server thinks it is.
    expect(lagosLocalToInstant("2026-09-10T14:30", NOW)?.toISOString()).toBe(
      "2026-09-10T13:30:00.000Z",
    );
  });

  it("refuses a slot in the past rather than storing one", () => {
    expect(lagosLocalToInstant("2026-09-08T08:00", NOW)).toBeNull();
  });

  it("refuses a date the calendar does not have", () => {
    // Date.UTC rolls this into March; a slot the customer never chose is worse
    // than no slot at all.
    expect(lagosLocalToInstant("2027-02-31T10:00", NOW)).toBeNull();
  });

  it("refuses a year-out typo", () => {
    expect(lagosLocalToInstant("2036-09-10T14:30", NOW)).toBeNull();
  });

  it("treats anything unparseable as absent", () => {
    for (const value of ["", "tomorrow", "2026-09-10", "2026-09-10T14:30:00", null, undefined]) {
      expect(lagosLocalToInstant(value, NOW)).toBeNull();
    }
  });

  it("accepts a slot just inside the window", () => {
    expect(lagosLocalToInstant("2026-09-08T11:00", NOW)).not.toBeNull();
  });
});
