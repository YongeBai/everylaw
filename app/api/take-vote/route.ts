import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

const schema = z.object({ takeId: z.number().int().positive(), direction: z.union([z.literal(1), z.literal(-1)]).nullable().optional().default(1) });

export async function GET(request: NextRequest) {
  try {
    const takeId = Number(request.nextUrl.searchParams.get("takeId"));
    if (!Number.isInteger(takeId) || takeId < 1) return NextResponse.json({ error: "Invalid argument" }, { status: 400 });
    const identity = requestIdentity(request);
    const rows = await db.execute(sql`SELECT t.upvote_count, t.downvote_count, tv.direction FROM takes t LEFT JOIN take_votes tv ON tv.take_id=t.id AND tv.voter_hash=${identity.voterHash} WHERE t.id=${takeId} AND t.moderation_status='published'`);
    if (!rows[0]) return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    return NextResponse.json({ upvoteCount: Number(rows[0].upvote_count), downvoteCount: Number(rows[0].downvote_count), direction: rows[0].direction == null ? null : Number(rows[0].direction) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Load a page")) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("argument vote lookup failed", error); return NextResponse.json({ error: "Could not load vote" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const { takeId, direction } = schema.parse(await request.json()); const identity = requestIdentity(request);
    if (!await checkRateLimit("take-vote", identity)) return NextResponse.json({ error: "Vote limit reached. Try again later." }, { status: 429 });
    if (direction === null) {
      await db.execute(sql`DELETE FROM take_votes WHERE take_id=${takeId} AND voter_hash=${identity.voterHash}`);
    } else {
      await db.execute(sql`INSERT INTO take_votes(take_id, voter_hash, direction)
        SELECT id, ${identity.voterHash}, ${direction} FROM takes WHERE id=${takeId} AND moderation_status='published'
        ON CONFLICT (take_id, voter_hash) DO UPDATE SET direction=EXCLUDED.direction`);
    }
    const [, rows] = await Promise.all([
      recordInteraction("take-vote", identity),
      db.execute(sql`SELECT upvote_count, downvote_count FROM takes WHERE id=${takeId} AND moderation_status='published'`),
    ]);
    if (!rows[0]) return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    return NextResponse.json({ upvoteCount: Number(rows[0].upvote_count), downvoteCount: Number(rows[0].downvote_count), direction });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid argument" }, { status: 400 });
    if (error instanceof Error && error.message.includes("Load a page")) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("argument vote failed", error); return NextResponse.json({ error: "Could not vote" }, { status: 500 });
  }
}
