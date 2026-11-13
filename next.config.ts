import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedEnv: false },
  // Title communities live under /r; site-wide utilities stay top-level.
  redirects: async () => [
    // Legacy named title slugs on law pages (/r/title-18-CRIMES…/700). Done here
    // rather than in the law page: that page is statically cached per URL, so a
    // redirect issued there would be generated and stored once per spelling.
    { source: "/r/title-:num(\\d+)-:name/:section((?!wiki$)[^/]+)", destination: "/r/title-:num/:section", permanent: true },
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
