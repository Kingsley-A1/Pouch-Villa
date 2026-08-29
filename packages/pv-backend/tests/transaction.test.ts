import { describe, expect, it } from "vitest";
import { isRetryable } from "../src/db/client";
import { backoffDelayMs, MAX_TRANSACTION_ATTEMPTS } from "../src/db/transaction";
import { checksum } from "../src/db/migrate";

describe("CockroachDB retry handling", () => {
  it("treats a serialization conflict as retryable", () => {
    expect(isRetryable({ code: "40001" })).toBe(true);
  });

  it("does not retry a genuine constraint violation", () => {
    // Retrying a unique-violation just fails again and hides the real defect.
    expect(isRetryable({ code: "23505" })).toBe(false);
    expect(isRetryable(new Error("boom"))).toBe(false);
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });

  it("backs off within a bounded, jittered window", () => {
    expect(backoffDelayMs(1, () => 1)).toBe(20);
    expect(backoffDelayMs(1, () => 0)).toBe(0);
    // Jitter is full-range, so retrying clients do not collide again in lockstep.
    expect(backoffDelayMs(4, () => 1)).toBe(160);
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      expect(backoffDelayMs(attempt, () => 1)).toBeLessThanOrEqual(500);
    }
  });
});

describe("migration integrity", () => {
  it("hashes identically regardless of line endings", () => {
    // The repo is developed on Windows and built on Linux; a checksum that changed
    // with CRLF would report every migration as edited on the other platform.
    expect(checksum("CREATE TABLE a();\nCREATE TABLE b();\n")).toBe(
      checksum("CREATE TABLE a();\r\nCREATE TABLE b();\r\n"),
    );
  });

  it("changes when the migration body actually changes", () => {
    expect(checksum("CREATE TABLE a();")).not.toBe(checksum("CREATE TABLE b();"));
  });
});
