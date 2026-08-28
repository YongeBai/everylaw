import { sql } from "drizzle-orm";
import { db } from "@/db";

type Identity = { voterHash: string; ipHash: string };
const limits = { vote: 30, take: 5, "take-vote": 60 } as const;
type Action = keyof typeof limits;

// One limiter per action for the process lifetime — rebuilding per request
// would throw away @upstash/ratelimit's in-memory blocklist cache.
type Limiter = { limit: (key: string) => Promise<{ success: boolean }> };
const limiters = new Map<Action, Promise<Limiter>>();
function redisLimiter(action: Action, url: string, token: string): Promise<Limiter> {
  let limiter = limiters.get(action);
  if (!limiter) {
    limiter = Promise.all([import("@upstash/ratelimit"), import("@upstash/redis")]).then(([{ Ratelimit }, { Redis }]) =>
      new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(limits[action], "1 h"), prefix: `everylaw:${action}` }));
    limiters.set(action, limiter);
  }
  return limiter;
}

export async function checkRateLimit(action: Action, identity: Identity): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL; const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const limiter = await redisLimiter(action, redisUrl, redisToken);
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
