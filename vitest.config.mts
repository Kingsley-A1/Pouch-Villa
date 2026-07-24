import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], coverage: { reporter: ["text", "html"], include: ["src/lib/**/*.ts", "src/components/**/*.tsx"] } },
});
