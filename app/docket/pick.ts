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


/**
 * The trials ledger is the durable truth for which section stands trial on a
 * given day: the deterministic pick shifts whenever the pool changes (new AI
 * content, curation edits), so it runs at most once per day — the first
 * docket render computes and records it, every later render reads the row.
 */
async function getOrRecordTodayTrial(todayKey: string): Promise<number | null> {
  const stored = await db.execute(sql`SELECT node_id FROM trials WHERE day_key = ${todayKey}`);
  if (stored[0]) return Number(stored[0].node_id);
  const pickedId = await trialIdForDay(todayKey);
  if (!pickedId) return null;
  await db.execute(sql`INSERT INTO trials (day_key, node_id) VALUES (${todayKey}, ${pickedId}) ON CONFLICT (day_key) DO NOTHING`);
  // Re-read so concurrent first renders agree on the row that won the insert.
  const settled = await db.execute(sql`SELECT node_id FROM trials WHERE day_key = ${todayKey}`);
  return settled[0] ? Number(settled[0].node_id) : pickedId;
}

/** Stamp final verdicts on past days from the live aggregates. */
async function closePastTrials(todayKey: string): Promise<void> {
  await db.execute(sql`
    UPDATE trials SET
      keep_count = COALESCE(v.keep_count, 0),
      dissolve_count = COALESCE(v.dissolve_count, 0),
      closed_at = now()
    FROM trials t LEFT JOIN vote_aggregates v ON v.node_id = t.node_id
    WHERE trials.day_key = t.day_key AND trials.day_key < ${todayKey} AND trials.closed_at IS NULL`);
}


export type YesterdayVerdict = { law: LawSummary; keepCount: number; dissolveCount: number };

export type Docket = {
  law: LawSummary;
  summary: string | null;
  explanation: string | null;
  origin: string | null;
  takes: Awaited<ReturnType<typeof getTakes>>;
  locallyDefinedTerms: string[];
  yesterday: YesterdayVerdict | null;
  todayKey: string;
};

export async function getDocket(): Promise<Docket | null> {
  const todayKey = dayKey();
  const todayId = await getOrRecordTodayTrial(todayKey);
  if (!todayId) return null;
  await closePastTrials(todayKey);
  // Yesterday's recap uses the STAMPED verdict from the ledger — the numbers
  // frozen at midnight, not live counts. Pre-ledger days have no row and no
  // recap (recomputing against today's pool would point at the wrong section
  // whenever the pool has changed since).
  const yesterdayRows = await db.execute(sql`
    SELECT node_id, keep_count, dissolve_count FROM trials
    WHERE day_key = ${dayKey(-1)} AND closed_at IS NOT NULL`);
  const yesterdaySnap = yesterdayRows[0] ?? null;
  const yesterdayId = yesterdaySnap ? Number(yesterdaySnap.node_id) : null;
  const [law, aiContent, takes, yesterdayLaw, locallyDefinedTerms] = await Promise.all([
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
    takes, locallyDefinedTerms,
    yesterday: yesterdayLaw && yesterdaySnap
      ? { law: yesterdayLaw, keepCount: Number(yesterdaySnap.keep_count ?? 0), dissolveCount: Number(yesterdaySnap.dissolve_count ?? 0) }
      : null,
    todayKey,
  };
}
