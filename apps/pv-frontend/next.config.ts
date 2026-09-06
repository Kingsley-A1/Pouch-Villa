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

/**
 * Product media is served from the R2 public bucket's CDN origin. next/image
 * will only optimise a remote host it has been told about, and the host differs
 * per environment, so it is derived from the same variable that builds the URLs.
 *
 * Deliberately not `images.unoptimized`: the prototype set that globally to dodge
 * a hosting-plan limit, which forfeits resizing and modern formats on every image
 * in the app. AGENTS.md §2 rules it out.
 */
type RemotePattern = { protocol: "http" | "https"; hostname: string };

function mediaRemotePatterns(): RemotePattern[] {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) return [];
  try {
    const { protocol, hostname } = new URL(base);
    return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname }];
  } catch {
    return [];
  }
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
  images: {
    remotePatterns: mediaRemotePatterns(),
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
