import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT count(*)::int AS laws FROM law_nodes WHERE node_type='section'`);
    return NextResponse.json({ ok: true, laws: Number(result[0]?.laws ?? 0) });
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
