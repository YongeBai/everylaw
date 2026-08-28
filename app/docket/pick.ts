import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getAiContent, getLawById, getLawLiteById, getTakes, getTermsDefinedByLaw, type LawSummary } from "@/lib/data";
import { viewerVoterHash } from "@/lib/viewer";
import { docketDayKey } from "@/lib/docket-day";

/** Trial days roll over at midnight Pacific time. */
export const dayKey = (offsetDays = 0): string => docketDayKey(new Date(), offsetDays);

/** Deterministic index for the day within a pool of the given size. */
function pickIndexForDay(poolSize: number, key: string): number {
  const digest = createHash("sha256").update(`everylaw-docket:${key}`).digest();
  return digest.readUInt32BE(0) % poolSize;
}

// A trial needs stakes: only sections that impose a punishment (fine,
// imprisonment, penalty, forfeiture) stand trial, and definition sections
// never do. The pool is further capped by published AI summaries.
const DOCKET_POOL = sql.raw(`FROM law_nodes WHERE node_type = 'section' AND status = 'active'
  AND heading NOT ILIKE '%definition%'
  AND body_text ~* 'shall be (fined|imprisoned|punished)|fined under this title|imprison|penalt|punish|forfeit'
  AND EXISTS (SELECT 1 FROM ai_contents c WHERE c.node_id = law_nodes.id AND c.content_type = 'summary' AND c.status = 'published')`);

async function trialIdForDay(key: string): Promise<number | null> {
  const countRows = await db.execute(sql`SELECT count(*)::int n ${DOCKET_POOL}`);
  const poolSize = Number(countRows[0]!.n);
  if (poolSize === 0) return null;
  const offset = pickIndexForDay(poolSize, key);
  const idRows = await db.execute(sql`SELECT id ${DOCKET_POOL} ORDER BY id OFFSET ${offset} LIMIT 1`);
  return idRows[0] ? Number(idRows[0].id) : null;
}

export type Docket = {
  law: LawSummary;
  summary: string | null;
  explanation: string | null;
  origin: string | null;
  takes: Awaited<ReturnType<typeof getTakes>>;
  locallyDefinedTerms: string[];
  yesterday: LawSummary | null;
  todayKey: string;
};

export async function getDocket(): Promise<Docket | null> {
  const todayKey = dayKey();
  const [todayId, yesterdayId] = await Promise.all([trialIdForDay(todayKey), trialIdForDay(dayKey(-1))]);
  if (!todayId) return null;
  const [law, aiContent, takes, yesterday, locallyDefinedTerms] = await Promise.all([
    getLawById(todayId),
    getAiContent(todayId),
    viewerVoterHash().then((hash) => getTakes(todayId, hash)),
    // Yesterday's law only feeds the verdict recap line — skip the statute bodies.
    yesterdayId === null || yesterdayId === todayId ? Promise.resolve(null) : getLawLiteById(yesterdayId),
    getTermsDefinedByLaw(todayId),
  ]);
  if (!law) return null;
  return {
    law,
    summary: aiContent.summary?.body ?? aiContent.explanation?.body ?? null,
    explanation: aiContent.explanation?.body ?? null,
    origin: aiContent.origin?.body ?? null,
    takes, locallyDefinedTerms, yesterday, todayKey,
  };
}
