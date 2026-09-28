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
  // sharp is a native addon: it must be required at runtime from its own
  // node_modules location, never bundled into a chunk, or its dlopen of the
  // sibling libvips binary breaks. Only the media-upload path touches sharp at
  // all — catalogue reads no longer import it (see storage/media-key.ts) — but
  // wherever it is imported, this keeps the build from bundling it.
  serverExternalPackages: ["sharp"],
  /**
   * Every image is resized by sharp before it is ever requested — uploads on
   * their way into R2, bundled photographs by scripts/build-static-images.mjs —
   * so the loader only picks the right pre-built file and the browser fetches it
   * directly. Nothing goes through `/_next/image`, which on this deployment's
   * Vercel plan answers 402 once the monthly transformation allowance is spent:
   * the broken product-page images of September 2026.
   *
   * Deliberately not `unoptimized`, which AGENTS.md §2 rules out: that would
   * send full-size originals with no `srcset`. See ADR 0019.
   */
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
    /**
     * Cross-fades a route change instead of blanking the page between them.
     *
     * The client asked for the shop to feel alive, and on a slow connection the
     * most conspicuously dead moment is the white gap between tapping a product
     * and seeing it. This is the browser's own View Transitions API, which
     * animates on the compositor: it costs no JavaScript we ship and it degrades
     * to today's instant swap in a browser that does not implement it.
     *
     * Still flagged experimental by Next, so it is deliberately used at its
     * least invasive setting — the flag and a CSS cross-fade in `globals.css`,
     * with no `<ViewTransition>` boundaries in the tree. Nothing renders
     * differently if the flag is removed.
     *
     * The animation is dropped entirely under `prefers-reduced-motion`; see the
     * `::view-transition` rules in globals.css.
     */
    viewTransition: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
