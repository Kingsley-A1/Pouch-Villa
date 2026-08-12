import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    // The host's image optimizer is not available on this plan: /_next/image
    // answers 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED, which broke every
    // image on the deployed site. Serve the files straight from /public instead.
    // scripts/optimize-images.mjs keeps the sources small enough for that to be
    // a fair trade; re-run it after adding artwork.
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
