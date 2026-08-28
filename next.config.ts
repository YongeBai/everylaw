import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedEnv: false },
  // Title communities live under /r; site-wide utilities stay top-level.
  redirects: async () => [
    { source: "/r/history", destination: "/history", permanent: true },
    { source: "/r/random", destination: "/random", permanent: true },
    { source: "/titles", destination: "/r", permanent: true },
    { source: "/title-:titleSlug/:section", destination: "/r/title-:titleSlug/:section", permanent: true },
    { source: "/title-:titleSlug", destination: "/r/title-:titleSlug", permanent: true },
    { source: "/us", destination: "/r", permanent: true },
    { source: "/us/:titleSlug", destination: "/r/:titleSlug", permanent: true },
    { source: "/us/:titleSlug/:section", destination: "/r/:titleSlug/:section", permanent: true },
  ],
};

export default nextConfig;
