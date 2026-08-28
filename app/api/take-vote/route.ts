import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

const schema = z.object({ takeId: z.number().int().positive(), direction: z.union([z.literal(1), z.literal(-1)]).optional().default(1) });

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const { takeId, direction } = schema.parse(await request.json()); const identity = requestIdentity(request);
    if (!await checkRateLimit("take-vote", identity)) return NextResponse.json({ error: "Vote limit reached. Try again later." }, { status: 429 });
    await db.execute(sql`INSERT INTO take_votes(take_id, voter_hash, direction) VALUES (${takeId}, ${identity.voterHash}, ${direction}) ON CONFLICT (take_id, voter_hash) DO UPDATE SET direction=EXCLUDED.direction`);
    const [, rows] = await Promise.all([
      recordInteraction("take-vote", identity),
      db.execute(sql`SELECT upvote_count, downvote_count FROM takes WHERE id=${takeId}`),
    ]);
    if (!rows[0]) return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    return NextResponse.json({ upvoteCount: Number(rows[0].upvote_count), downvoteCount: Number(rows[0].downvote_count) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid argument" }, { status: 400 });
    console.error("take upvote failed", error); return NextResponse.json({ error: "Could not upvote" }, { status: 500 });
  }
}
