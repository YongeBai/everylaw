import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { rPostUrlFrom } from "@/lib/reddit-format";

/** Deal a batch of random in-force sections for the infinite review feed. */
export async function GET(request: NextRequest) {
  try {
    const seenParam = request.nextUrl.searchParams.get("seen") ?? "";
    const seen = seenParam.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 300);
    const count = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("count")) || 5));
    const exclusion = seen.length > 0 ? sql`AND n.id NOT IN ${seen}` : sql``;
    const rows = await db.execute(sql`
      SELECT n.id, n.identifier, n.citation, n.num, n.heading, n.status, n.word_count, n.enacted_date, n.enacting_pl,
        left(n.body_text, 400) AS excerpt,
        COALESCE(v.keep_count,0) keep_count, COALESCE(v.dissolve_count,0) dissolve_count,
        s.body_md AS summary, e.body_md AS explanation
      FROM law_nodes n
      LEFT JOIN vote_aggregates v ON v.node_id = n.id
      LEFT JOIN ai_contents s ON s.node_id = n.id AND s.content_type = 'summary' AND s.status = 'published'
      LEFT JOIN ai_contents e ON e.node_id = n.id AND e.content_type = 'explanation' AND e.status = 'published'
      WHERE n.node_type = 'section' AND n.status = 'active' AND n.word_count > 10 ${exclusion}
      ORDER BY random()
      LIMIT ${count}
    `);
    const laws = rows.map((row) => {
      const title = Number(String(row.identifier).match(/\/t(\d+)/)?.[1] ?? 0);
      return {
        id: Number(row.id), citation: String(row.citation), heading: String(row.heading), title,
        url: rPostUrlFrom(title, String(row.num), String(row.identifier)),
        wordCount: Number(row.word_count), enactedDate: row.enacted_date ? String(row.enacted_date) : null,
        enactingPl: row.enacting_pl ? String(row.enacting_pl) : null,
        keepCount: Number(row.keep_count), dissolveCount: Number(row.dissolve_count),
        summary: row.summary ? String(row.summary) : null,
        explanation: row.explanation ? String(row.explanation) : null,
        excerpt: String(row.excerpt ?? ""),
      };
    });
    return NextResponse.json({ laws });
  } catch (error) {
    console.error("random deal failed", error);
    return NextResponse.json({ error: "Could not deal laws" }, { status: 500 });
  }
}
