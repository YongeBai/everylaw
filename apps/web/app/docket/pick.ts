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

/** Deterministic pick: everyone sees the same defendant on the same day. */
export function pickForDay(ids: number[], key: string): number {
  const digest = createHash("sha256").update(`everylaw-docket:${key}`).digest();
  return ids[digest.readUInt32BE(0) % ids.length];
}

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
  const poolRows = await db.execute(sql`
    SELECT id FROM law_nodes
    WHERE node_type = 'section' AND status = 'active' AND featured_tier >= 1
    ORDER BY id
  `);
  const ids = poolRows.map((row) => Number(row.id));
  if (ids.length === 0) return null;
  const todayKey = dayKey();
  const todayId = pickForDay(ids, todayKey);
  const yesterdayId = pickForDay(ids, dayKey(-1));
  const [law, aiContent, takes, yesterday] = await Promise.all([
    getLawById(todayId),
    getAiContent(todayId),
    viewerVoterHash().then((hash) => getTakes(todayId, hash)),
    yesterdayId === todayId ? Promise.resolve(null) : getLawById(yesterdayId),
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
