import { defineConfig } from "@neon/config/v1";

// EveryLaw uses exactly one Neon service: Lakebase Postgres (implicit — every
// project has it). No Neon Auth (voting is anonymous cookie + salted hash),
// no Data API, Object Storage, Functions, or AI Gateway (the AI pipeline calls
// Anthropic directly and runs locally, never in the deployed app).
export default defineConfig({
  branch: (branch) => {
    if (branch.exists) return {};
    // Dev/preview branches: cheap, scale-to-zero, self-cleaning.
    if (!branch.isDefault) {
      return {
        ttl: "7d",
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: "5m",
          },
        },
      };
    }
    return {};
  },
});
