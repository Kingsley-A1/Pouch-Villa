import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ESLint runs from the workspace root, so Next has to be told where the app lives.
    settings: { next: { rootDir: "apps/pv-frontend" } },
  },
  {
    // The backend package must stay framework-free so it can be lifted into another
    // project, and so no driver or secret can reach a Client Component.
    files: ["packages/pv-backend/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "pv-backend must not depend on Next.js." },
            { group: ["react", "react-dom"], message: "pv-backend must not depend on React." },
            { group: ["@/*"], message: "Use a relative import inside pv-backend." },
          ],
        },
      ],
    },
  },
  // Patterns must be workspace-relative: a bare ".next/**" misses apps/*/.next,
  // which puts generated build output through the linter.
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    "**/node_modules/**",
  ]),
]);

export default eslintConfig;
