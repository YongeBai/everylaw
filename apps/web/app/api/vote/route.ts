import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

const inputSchema = z.object({ nodeId: z.number().int().positive(), direction: z.enum(["keep", "dissolve"]) });

export async function GET(request: NextRequest) {
  try {
    const nodeId = Number(request.nextUrl.searchParams.get("nodeId")); if (!Number.isInteger(nodeId) || nodeId < 1) return NextResponse.json({ error: "Invalid law" }, { status: 400 });
    const identity = requestIdentity(request);
    const rows = await db.execute(sql`SELECT COALESCE(a.keep_count,0) keep_count, COALESCE(a.dissolve_count,0) dissolve_count, COALESCE(a.total_count,0) total_count, COALESCE(a.dissolve_ratio,0) dissolve_ratio, v.direction FROM law_nodes n LEFT JOIN vote_aggregates a ON a.node_id=n.id LEFT JOIN votes v ON v.node_id=n.id AND v.voter_hash=${identity.voterHash} WHERE n.id=${nodeId}`);
    if (!rows[0]) return NextResponse.json({ error: "Law not found" }, { status: 404 }); const row = rows[0];
    return NextResponse.json({ keepCount: Number(row.keep_count), dissolveCount: Number(row.dissolve_count), totalCount: Number(row.total_count), dissolveRatio: Number(row.dissolve_ratio), direction: row.direction ? String(row.direction) : undefined });
  } catch (error) { console.error("vote lookup failed", error); return NextResponse.json({ error: "Vote lookup failed" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const input = inputSchema.parse(await request.json());
    const identity = requestIdentity(request);
    if (!await checkRateLimit("vote", identity)) return NextResponse.json({ error: "Vote limit reached. Try again later." }, { status: 429 });
    await db.execute(sql`
      INSERT INTO votes(node_id, voter_hash, ip_hash, user_agent_hash, direction)
      VALUES (${input.nodeId}, ${identity.voterHash}, ${identity.ipHash}, ${identity.userAgentHash}, ${input.direction}::vote_direction)
      ON CONFLICT (node_id, voter_hash) DO UPDATE SET direction=EXCLUDED.direction, ip_hash=EXCLUDED.ip_hash, user_agent_hash=EXCLUDED.user_agent_hash, updated_at=now()
    `);
    await recordInteraction("vote", identity);
    const aggregate = await db.execute(sql`SELECT keep_count, dissolve_count, total_count, dissolve_ratio FROM vote_aggregates WHERE node_id=${input.nodeId}`);
    const row = aggregate[0]!;
    return NextResponse.json({ keepCount: Number(row.keep_count), dissolveCount: Number(row.dissolve_count), totalCount: Number(row.total_count), dissolveRatio: Number(row.dissolve_ratio), direction: input.direction });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
    if (error instanceof Error && error.message.includes("Load a page")) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("vote failed", error); return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }
}
