import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a lockfile higher up the tree can't confuse tracing.
  outputFileTracingRoot: __dirname,
  // Prescription uploads are sent to Server Actions/route handlers as data URLs in
  // this prototype. Production should stream to object storage instead (see README).
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
