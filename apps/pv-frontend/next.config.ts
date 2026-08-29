import type { NextConfig } from "next";

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
