import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB, too small for a training slide deck or PDF upload.
    // The app-enforced 20MB cap in learning/actions.ts leaves headroom
    // under this for multipart boundary/header overhead.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
