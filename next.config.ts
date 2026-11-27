import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "thespacedevs-prod.nyc3.digitaloceanspaces.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "echarts"],
  },
};

export default nextConfig;
