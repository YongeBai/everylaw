import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedEnv: false },
  // /us was the old "citable record" surface; /r is now the only law surface.
  redirects: async () => [
    { source: "/us", destination: "/r", permanent: true },
    { source: "/us/:titleSlug", destination: "/r/:titleSlug", permanent: true },
    { source: "/us/:titleSlug/:section", destination: "/r/:titleSlug/:section", permanent: true },
  ],
};

export default nextConfig;
