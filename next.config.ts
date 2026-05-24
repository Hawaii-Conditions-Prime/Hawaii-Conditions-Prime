import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/mcp",
        destination: "/api/mcp",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

