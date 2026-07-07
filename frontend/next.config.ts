import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        // GitHub user avatars (e.g. avatars.githubusercontent.com/u/12345)
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        // GitHub raw content (e.g. raw.githubusercontent.com)
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        // GitHub social previews / opengraph images
        protocol: "https",
        hostname: "*.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
