import "./env.js";
import { Command } from "commander";
import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/db";

const options = new Command().option("--limit <number>", "candidate count", "2500").option("--apply", "mark top candidates tier 2").parse().opts<{ limit: string; apply?: boolean }>();
const limit = Number(options.limit);
if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid limit: ${options.limit}`);
const rows = await db.execute(sql`
  SELECT id, citation, heading, amendment_count, enacted_date, word_count,
    (CASE WHEN identifier ~ '/t(18|21|26|15|17|47)/' THEN 30 ELSE 0 END
    + CASE WHEN amendment_count=0 AND enacted_date < '1950-01-01' THEN 25 ELSE 0 END
    + CASE WHEN word_count < 120 THEN 18 ELSE 0 END
    + CASE WHEN heading ~* '(flag|murder|kidnap|margarine|tax|speech|housing|food|privacy|weapon)' THEN 40 ELSE 0 END) AS interest_score
  FROM law_nodes WHERE node_type='section' AND status='active'
  ORDER BY interest_score DESC, amendment_count DESC LIMIT ${limit}
`);
if (options.apply) {
  const ids = rows.map((row) => Number(row.id));
  if (ids.length) await db.execute(sql`UPDATE law_nodes SET featured_tier=2 WHERE id IN ${sql`(${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`}`);
}
console.log(JSON.stringify({ applied: Boolean(options.apply), candidates: rows }, null, 2));
await sqlClient.end();
