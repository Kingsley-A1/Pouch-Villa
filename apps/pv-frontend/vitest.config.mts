import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@pv/backend": fileURLToPath(new URL("../../packages/pv-backend/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Module transform on a cold cache has exceeded the 5s default and failed CI
    // on a fresh runner while passing everywhere warm.
    testTimeout: 30_000,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/components/**/*.tsx", "src/lib/**/*.ts", "src/server/**/*.ts"],
    },
  },
});
