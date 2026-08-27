import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

const schema = z.object({ nodeId: z.number().int().positive(), stance: z.enum(["keep", "dissolve"]).optional(), body: z.string().trim().min(3).max(280), website: z.string().max(0), parentId: z.number().int().positive().optional() });
const blocked = /\b(kill yourself|nazi|racial slur)\b/i;

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const input = schema.parse(await request.json()); const identity = requestIdentity(request);
    if (!await checkRateLimit("take", identity)) return NextResponse.json({ error: "Take limit reached. Try again later." }, { status: 429 });
    if (blocked.test(input.body)) return NextResponse.json({ error: "That case did not pass moderation." }, { status: 422 });
    if (input.parentId) {
      const parent = await db.execute(sql`SELECT node_id FROM takes WHERE id=${input.parentId} AND moderation_status='published'`);
      if (!parent[0] || Number(parent[0].node_id) !== input.nodeId) return NextResponse.json({ error: "Parent comment not found on this law" }, { status: 404 });
    }
    // takes.stance removed (0007): stance derives from the author's current vote.
    const rows = await db.execute(sql`INSERT INTO takes(node_id, voter_hash, body, parent_id) VALUES (${input.nodeId}, ${identity.voterHash}, ${input.body}, ${input.parentId ?? null}) RETURNING id, body, upvote_count, downvote_count, parent_id, created_at`);
    const voteRows = await db.execute(sql`SELECT direction FROM votes WHERE node_id=${input.nodeId} AND voter_hash=${identity.voterHash}`);
    const derivedStance = voteRows[0]?.direction ? String(voteRows[0].direction) : null;
    await recordInteraction("take", identity);
    const row = rows[0]!;
    return NextResponse.json({ take: { id: Number(row.id), stance: derivedStance, body: String(row.body), upvoteCount: Number(row.upvote_count), downvoteCount: Number(row.downvote_count), parentId: row.parent_id === null ? null : Number(row.parent_id), createdAt: String(row.created_at) } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Use 3–280 characters and choose a side." }, { status: 400 });
    console.error("take failed", error); return NextResponse.json({ error: "Could not publish the case" }, { status: 500 });
  }
}
