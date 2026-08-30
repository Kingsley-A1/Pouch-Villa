import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

/**
 * Next loads .env from this app's directory, but the workspace keeps one .env at
 * the repository root so the backend scripts and the app share a single file.
 * Without this the storefront starts and then fails on its first query, which is a
 * confusing way to discover a missing connection string.
 *
 * A real environment variable — what a host injects — is already set by this point
 * and `loadEnvFile` does not overwrite it, so deployment always wins over the file.
 */
for (const name of [".env", ".env.local"]) {
  const path = resolve(import.meta.dirname, "../..", name);
  if (existsSync(path)) process.loadEnvFile(path);
}

const nextConfig: NextConfig = {
  // pv-backend ships TypeScript source rather than a build artefact, so the app
  // compiles it as part of its own build.
  transpilePackages: ["@pv/backend"],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
