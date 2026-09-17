import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Practitioner photos are admin-entered URLs on any host — allow HTTPS
    // sources while keeping Next.js optimization (AVIF/WebP). When a photo
    // is missing the UI falls back to an icon, so broken hosts degrade
    // gracefully instead of breaking the page.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
