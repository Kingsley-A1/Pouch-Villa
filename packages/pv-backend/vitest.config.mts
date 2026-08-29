import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Module transform on a cold cache has exceeded the 5s default and failed CI
    // on a fresh runner while passing everywhere warm.
    testTimeout: 30_000,
    coverage: { reporter: ["text", "html"], include: ["src/**/*.ts"] },
  },
});
