import { cache } from "react";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { getAiContent, getLawById, getTakes, type LawSummary } from "@/lib/data";
import { viewerVoterHash } from "@/lib/viewer";

/** Trial days roll over at midnight Pacific time. */
export function dayKey(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Deterministic index for the day within a pool of the given size. */
export function pickIndexForDay(poolSize: number, key: string): number {
  const digest = createHash("sha256").update(`everylaw-docket:${key}`).digest();
  return digest.readUInt32BE(0) % poolSize;
}

const DOCKET_POOL = sql.raw(`FROM law_nodes WHERE node_type = 'section' AND status = 'active' AND featured_tier >= 1`);

async function trialIdForDay(key: string): Promise<number | null> {
  const countRows = await db.execute(sql`SELECT count(*)::int n ${DOCKET_POOL}`);
  const poolSize = Number(countRows[0]!.n);
  if (poolSize === 0) return null;
  const offset = pickIndexForDay(poolSize, key);
  const idRows = await db.execute(sql`SELECT id ${DOCKET_POOL} ORDER BY id OFFSET ${offset} LIMIT 1`);
  return idRows[0] ? Number(idRows[0].id) : null;
}

/** Today's trial law id — request-cached so the post page can verify banners. */
export const getTodayTrialId = cache(() => trialIdForDay(dayKey()));

export type Docket = {
  law: LawSummary;
  summary: string | null;
  explanation: string | null;
  origin: string | null;
  takes: Awaited<ReturnType<typeof getTakes>>;
  yesterday: LawSummary | null;
  trialNumber: number;
  todayKey: string;
};

export async function getDocket(): Promise<Docket | null> {
  const todayKey = dayKey();
  const [todayId, yesterdayId] = await Promise.all([getTodayTrialId(), trialIdForDay(dayKey(-1))]);
  if (!todayId) return null;
  const [law, aiContent, takes, yesterday] = await Promise.all([
    getLawById(todayId),
    getAiContent(todayId),
    viewerVoterHash().then((hash) => getTakes(todayId, hash)),
    yesterdayId === null || yesterdayId === todayId ? Promise.resolve(null) : getLawById(yesterdayId),
  ]);
  if (!law) return null;
  const trialNumber = Math.floor((Date.parse(todayKey) - Date.parse("2026-08-25")) / 86_400_000) + 1;
  return {
    law,
    summary: aiContent.summary?.body ?? aiContent.explanation?.body ?? null,
    explanation: aiContent.explanation?.body ?? null,
    origin: aiContent.origin?.body ?? null,
    takes, yesterday, trialNumber, todayKey,
  };
}
