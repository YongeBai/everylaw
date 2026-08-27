import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { isAdmin } from "@/lib/security";

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.execute(sql`SELECT a.id, a.node_id, a.content_type, a.body_md, a.model, a.prompt_version, a.created_at, n.citation, n.heading FROM ai_contents a JOIN law_nodes n ON n.id=a.node_id WHERE a.status='draft' ORDER BY a.created_at DESC LIMIT 200`);
  return NextResponse.json({ items: rows.map((row) => ({ id: Number(row.id), nodeId: Number(row.node_id), contentType: String(row.content_type), body: String(row.body_md), model: String(row.model), promptVersion: String(row.prompt_version), citation: String(row.citation), heading: String(row.heading) })) });
}

const actionSchema = z.object({ id: z.number().int().positive(), action: z.enum(["publish", "reject", "regenerate"]) });
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = actionSchema.parse(await request.json());
    const found = await db.execute(sql`SELECT a.*, n.citation, n.heading, n.word_count, n.amendment_count, n.enacting_pl, n.enacted_date FROM ai_contents a JOIN law_nodes n ON n.id=a.node_id WHERE a.id=${input.id}`);
    if (!found[0]) return NextResponse.json({ error: "Draft not found" }, { status: 404 }); const row = found[0];
    if (input.action === "publish") {
      await db.transaction(async (tx) => {
        await tx.execute(sql`UPDATE ai_contents SET status='rejected', reviewed_at=now() WHERE node_id=${Number(row.node_id)} AND content_type=${String(row.content_type)}::ai_content_type AND status='published'`);
        await tx.execute(sql`UPDATE ai_contents SET status='published', reviewed_at=now() WHERE id=${input.id}`);
      });
    } else if (input.action === "reject") await db.execute(sql`UPDATE ai_contents SET status='rejected', reviewed_at=now() WHERE id=${input.id}`);
    else {
      const body = String(row.content_type) === "origin" ? `The source credit connects ${row.citation} to ${row.enacting_pl || "an unidentified public law"}${row.enacted_date ? ` on ${row.enacted_date}` : ""}. It does not, by itself, establish why Congress acted.` : `This section sets federal rules concerning ${String(row.heading).toLowerCase()}. Read the official text for exact scope and exceptions.`;
      await db.execute(sql`UPDATE ai_contents SET status='rejected', reviewed_at=now() WHERE id=${input.id}`);
      await db.execute(sql`INSERT INTO ai_contents(node_id, content_type, body_md, model, prompt_version, status) VALUES (${Number(row.node_id)}, ${String(row.content_type)}::ai_content_type, ${body}, 'local-deterministic', ${`${String(row.content_type)}.v1-regenerated`}, 'draft')`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid review action" }, { status: 400 }); console.error("review failed", error); return NextResponse.json({ error: "Review failed" }, { status: 500 }); }
}
