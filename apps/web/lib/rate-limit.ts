import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";

type Identity = { voterHash: string; ipHash: string };
const limits = { vote: 30, take: 5, "take-vote": 60, matchup: 300, guess: 600 } as const;
type Action = keyof typeof limits;

export async function checkRateLimit(action: Action, identity: Identity): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL; const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const [{ Ratelimit }, { Redis }] = await Promise.all([import("@upstash/ratelimit"), import("@upstash/redis")]);
    const limiter = new Ratelimit({ redis: new Redis({ url: redisUrl, token: redisToken }), limiter: Ratelimit.slidingWindow(limits[action], "1 h"), prefix: `everylaw:${action}` });
    const [voter, ip] = await Promise.all([limiter.limit(`voter:${identity.voterHash}`), limiter.limit(`ip:${identity.ipHash}`)]);
    return voter.success && ip.success;
  }
  const recent = await db.execute(sql`SELECT count(*)::int count FROM interaction_events WHERE action=${action} AND (voter_hash=${identity.voterHash} OR ip_hash=${identity.ipHash}) AND created_at > now() - interval '1 hour'`);
  return Number(recent[0]!.count) < limits[action];
}

export async function recordInteraction(action: Action, identity: Identity) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return;
  await db.execute(sql`INSERT INTO interaction_events(action, voter_hash, ip_hash) VALUES (${action}, ${identity.voterHash}, ${identity.ipHash})`);
}
