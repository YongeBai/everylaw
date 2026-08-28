import { sql } from "drizzle-orm";
import { db } from "@/db";

export type TrialRecord = { day: string; keepCount: number; dissolveCount: number; closed: boolean };

/** Most recent docket appearance for a section: today's open trial or the last stamped verdict. */
export async function getLatestTrial(nodeId: number): Promise<TrialRecord | null> {
  const rows = await db.execute(sql`
    SELECT day_key, keep_count, dissolve_count, (closed_at IS NOT NULL) closed FROM trials
    WHERE node_id = ${nodeId}
    ORDER BY day_key DESC LIMIT 1`);
  if (!rows[0]) return null;
  const day = rows[0].day_key instanceof Date ? rows[0].day_key.toISOString().slice(0, 10) : String(rows[0].day_key);
  return { day, keepCount: Number(rows[0].keep_count ?? 0), dissolveCount: Number(rows[0].dissolve_count ?? 0), closed: Boolean(rows[0].closed) };
}
