import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Module transform on a cold cache has exceeded the 5s default and failed CI
    // on a fresh runner while passing everywhere warm.
    testTimeout: 30_000,
    // A cold connection to the managed CockroachDB cluster has taken over a
    // minute; the default 10s hook timeout aborts setup before it lands.
    hookTimeout: 120_000,
    coverage: { reporter: ["text", "html"], include: ["src/**/*.ts"] },
  },
});
