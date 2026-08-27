import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

const K = 32;

type CardRow = Record<string, unknown>;

function toCard(row: CardRow) {
  const identifier = String(row.identifier);
  const title = Number(identifier.match(/\/t(\d+)/)?.[1] ?? 0);
  const suffix = identifier.match(/(~\d+)$/)?.[1] ?? "";
  return {
    id: Number(row.id),
    citation: String(row.citation),
    heading: String(row.heading),
    summary: row.summary ? String(row.summary) : String(row.excerpt ?? "").trim(),
    url: `/r/title-${title}/${encodeURIComponent(`${String(row.num)}${suffix}`)}`,
    elo: Math.round(Number(row.elo ?? 1500)),
    matches: Number(row.matches ?? 0),
    keepCount: Number(row.keep_count ?? 0),
    dissolveCount: Number(row.dissolve_count ?? 0),
  };
}

const cardSelect = sql.raw(`
  SELECT n.id, n.identifier, n.citation, n.num, n.heading,
    COALESCE(er.elo, 1500) elo, COALESCE(er.matches, 0) matches,
    COALESCE(v.keep_count, 0) keep_count, COALESCE(v.dissolve_count, 0) dissolve_count,
    s.body_md summary, left(n.body_text, 220) excerpt
  FROM law_nodes n
  LEFT JOIN elo_ratings er ON er.node_id = n.id
  LEFT JOIN vote_aggregates v ON v.node_id = n.id
  LEFT JOIN LATERAL (
    SELECT body_md FROM ai_contents
    WHERE node_id = n.id AND content_type = 'summary' AND status = 'published'
    ORDER BY id DESC LIMIT 1
  ) s ON true
`);

const poolWhere = sql.raw(`n.node_type = 'section' AND n.status = 'active' AND n.featured_tier >= 1`);

// GET: deal a pair from the rated pool.
export async function GET() {
  const rows = await db.execute(sql`${cardSelect} WHERE ${poolWhere} ORDER BY random() LIMIT 2`);
  if (rows.length < 2) return NextResponse.json({ error: "Not enough laws in the arena yet" }, { status: 503 });
  const totals = await db.execute(sql`SELECT count(*)::int total FROM matchup_votes`);
  return NextResponse.json({ pair: rows.map(toCard), totalMatchupVotes: Number(totals[0]!.total) });
}

const voteSchema = z.object({
  winnerId: z.number().int().positive(),
  loserId: z.number().int().positive(),
  website: z.string().max(0),
});

// POST: record a matchup vote and update both ELOs.
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const input = voteSchema.parse(await request.json());
    if (input.winnerId === input.loserId) return NextResponse.json({ error: "Pick two different laws" }, { status: 400 });
    const identity = requestIdentity(request);
    if (!(await checkRateLimit("matchup", identity))) {
      return NextResponse.json({ error: "Rating limit reached. Try again later." }, { status: 429 });
    }

    // Both laws must belong to the deal pool (no vote-stuffing arbitrary rows).
    const pool = await db.execute(
      sql`SELECT id FROM law_nodes n WHERE ${poolWhere} AND n.id IN (${input.winnerId}, ${input.loserId})`,
    );
    if (pool.length !== 2) return NextResponse.json({ error: "Unknown matchup" }, { status: 400 });

    // One vote per voter per (unordered) pair — same one-active-vote spirit as votes.
    const already = await db.execute(sql`
      SELECT 1 FROM matchup_votes
      WHERE voter_hash = ${identity.voterHash}
        AND ((winner_node_id = ${input.winnerId} AND loser_node_id = ${input.loserId})
          OR (winner_node_id = ${input.loserId} AND loser_node_id = ${input.winnerId}))
      LIMIT 1
    `);
    if (already.length > 0) return NextResponse.json({ error: "You already judged this matchup" }, { status: 409 });

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO elo_ratings (node_id) VALUES (${input.winnerId}), (${input.loserId})
        ON CONFLICT (node_id) DO NOTHING
      `);
      const rows = await tx.execute(sql`
        SELECT node_id, elo, matches, wins FROM elo_ratings
        WHERE node_id IN (${input.winnerId}, ${input.loserId})
        ORDER BY node_id FOR UPDATE
      `);
      const winner = rows.find((r) => Number(r.node_id) === input.winnerId)!;
      const loser = rows.find((r) => Number(r.node_id) === input.loserId)!;
      const winnerElo = Number(winner.elo);
      const loserElo = Number(loser.elo);
      const expectedWin = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
      const delta = K * (1 - expectedWin);
      const newWinner = winnerElo + delta;
      const newLoser = loserElo - delta;
      await tx.execute(sql`
        UPDATE elo_ratings SET elo = ${newWinner}, matches = matches + 1, wins = wins + 1, updated_at = now()
        WHERE node_id = ${input.winnerId}
      `);
      await tx.execute(sql`
        UPDATE elo_ratings SET elo = ${newLoser}, matches = matches + 1, updated_at = now()
        WHERE node_id = ${input.loserId}
      `);
      await tx.execute(sql`
        INSERT INTO matchup_votes (winner_node_id, loser_node_id, voter_hash, ip_hash)
        VALUES (${input.winnerId}, ${input.loserId}, ${identity.voterHash}, ${identity.ipHash})
      `);
      return { newWinner, newLoser, delta };
    });
    await recordInteraction("matchup", identity);

    const [pairStats, totals, mine] = await Promise.all([
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE winner_node_id = ${input.winnerId})::int agree,
          count(*)::int total
        FROM matchup_votes
        WHERE (winner_node_id = ${input.winnerId} AND loser_node_id = ${input.loserId})
           OR (winner_node_id = ${input.loserId} AND loser_node_id = ${input.winnerId})
      `),
      db.execute(sql`SELECT count(*)::int total FROM matchup_votes`),
      db.execute(sql`SELECT count(*)::int total FROM matchup_votes WHERE voter_hash = ${identity.voterHash}`),
    ]);
    const agree = Number(pairStats[0]!.agree);
    const pairTotal = Number(pairStats[0]!.total);
    return NextResponse.json({
      winner: { id: input.winnerId, elo: Math.round(result.newWinner), delta: Math.round(result.delta) },
      loser: { id: input.loserId, elo: Math.round(result.newLoser), delta: -Math.round(result.delta) },
      agreementPct: pairTotal > 0 ? Math.round((agree / pairTotal) * 100) : 100,
      pairVotes: pairTotal,
      totalMatchupVotes: Number(totals[0]!.total),
      yourJudgments: Number(mine[0]!.total),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid matchup vote" }, { status: 400 });
    if (error instanceof Error && error.message.includes("Load a page")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("matchup failed", error);
    return NextResponse.json({ error: "Could not record the matchup" }, { status: 500 });
  }
}
