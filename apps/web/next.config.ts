import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Next only auto-loads env files from the app directory. For local monorepo
// development, copy only variables used by the web app from the root file so
// pipeline-only credentials (for example ANTHROPIC_API_KEY) never enter the
// Next/Turbopack process environment or cache.
const webEnvironment = new Set([
  "DATABASE_URL",
  "VOTER_HASH_SECRET",
  "NEXT_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "ADMIN_PASSWORD",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);

try {
  const rootEnvironment = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  for (const line of rootEnvironment.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || !webEnvironment.has(match[1]) || process.env[match[1]]) continue;
    const value = match[2].trim();
    process.env[match[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
  }
} catch {
  // Hosted environments provide variables directly and do not have a root file.
}

const nextConfig: NextConfig = {
  transpilePackages: ["@everylaw/db"],
  experimental: { typedEnv: false },
  // /us was the old "citable record" surface; /r is now the only law surface.
  redirects: async () => [
    { source: "/us", destination: "/r", permanent: true },
    { source: "/us/:titleSlug", destination: "/r/:titleSlug", permanent: true },
    { source: "/us/:titleSlug/:section", destination: "/r/:titleSlug/:section", permanent: true },
  ],
};

export default nextConfig;
