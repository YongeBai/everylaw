import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { hashValue, isSameOrigin, requestIdentity } from "@/lib/security";
import { checkRateLimit, recordInteraction } from "@/lib/rate-limit";

/**
 * "Can't Make It Up" — deal a law heading that is either real (from the US
 * Code) or an invented decoy; the player guesses. The item's identity rides in
 * an HMAC-signed token so the client never sees the answer before guessing.
 */

function signToken(kind: "law" | "decoy", id: number): string {
  const payload = Buffer.from(`${kind}:${id}`).toString("base64url");
  return `${payload}.${hashValue(`realfake:${payload}`)}`;
}

function verifyToken(token: string): { kind: "law" | "decoy"; id: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || hashValue(`realfake:${payload}`) !== sig) return null;
  const [kind, idRaw] = Buffer.from(payload, "base64url").toString().split(":");
  const id = Number(idRaw);
  if ((kind !== "law" && kind !== "decoy") || !Number.isInteger(id) || id <= 0) return null;
  return { kind, id };
}

// Boring administrative headings are a giveaway (and no fun).
const realWhere = sql.raw(`
  n.node_type = 'section' AND n.status = 'active'
  AND length(n.heading) BETWEEN 12 AND 90
  AND n.word_count BETWEEN 20 AND 800
  AND n.heading !~* '^(definitions?|short title|authorization of appropriations|regulations|effective date|purposes?|findings|rules of construction)'
`);

export async function GET() {
  const dealReal = Math.random() < 0.5;
  if (dealReal) {
    const rows = await db.execute(sql`
      SELECT n.id, n.citation, n.heading FROM law_nodes n
      WHERE ${realWhere}
      ORDER BY random() LIMIT 1
    `);
    if (rows[0]) {
      const row = rows[0];
      return NextResponse.json({ token: signToken("law", Number(row.id)), citation: String(row.citation), heading: String(row.heading) });
    }
  }
  const rows = await db.execute(sql`SELECT id, citation, heading FROM decoys ORDER BY random() LIMIT 1`);
  if (!rows[0]) return NextResponse.json({ error: "The deck is empty" }, { status: 503 });
  const row = rows[0];
  return NextResponse.json({ token: signToken("decoy", Number(row.id)), citation: String(row.citation), heading: String(row.heading) });
}

const guessSchema = z.object({
  token: z.string().min(10).max(512),
  guessReal: z.boolean(),
  website: z.string().max(0),
});

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    const input = guessSchema.parse(await request.json());
    const item = verifyToken(input.token);
    if (!item) return NextResponse.json({ error: "Unrecognized card" }, { status: 400 });
    const identity = requestIdentity(request);
    if (!(await checkRateLimit("guess", identity))) {
      return NextResponse.json({ error: "Guess limit reached. Try again later." }, { status: 429 });
    }

    const wasReal = item.kind === "law";
    let revealed: Record<string, unknown> | null = null;
    if (wasReal) {
      const rows = await db.execute(sql`
        SELECT n.id, n.citation, n.heading, n.identifier, n.num, n.enacted_date,
          COALESCE(v.keep_count, 0) keep_count, COALESCE(v.dissolve_count, 0) dissolve_count
        FROM law_nodes n LEFT JOIN vote_aggregates v ON v.node_id = n.id
        WHERE n.id = ${item.id} LIMIT 1
      `);
      revealed = rows[0] ?? null;
    } else {
      const rows = await db.execute(sql`SELECT id, citation, heading FROM decoys WHERE id = ${item.id} LIMIT 1`);
      revealed = rows[0] ?? null;
    }
    if (!revealed) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const correct = input.guessReal === wasReal;
    await db.execute(sql`
      INSERT INTO guesses (item_kind, item_id, voter_hash, ip_hash, guessed_real, correct)
      VALUES (${item.kind}, ${item.id}, ${identity.voterHash}, ${identity.ipHash}, ${input.guessReal}, ${correct})
    `);
    await recordInteraction("guess", identity);

    const [crowd] = await db.execute(sql`
      SELECT count(*)::int total, count(*) FILTER (WHERE NOT correct)::int fooled
      FROM guesses WHERE item_kind = ${item.kind} AND item_id = ${item.id}
    `);
    const total = Number(crowd!.total);
    const fooledPct = total > 0 ? Math.round((Number(crowd!.fooled) / total) * 100) : 0;

    const identifier = wasReal ? String(revealed.identifier) : null;
    const title = identifier ? Number(identifier.match(/\/t(\d+)/)?.[1] ?? 0) : null;
    const suffix = identifier?.match(/(~\d+)$/)?.[1] ?? "";
    return NextResponse.json({
      correct,
      wasReal,
      item: {
        citation: String(revealed.citation),
        heading: String(revealed.heading),
        url: wasReal ? `/r/title-${title}/${encodeURIComponent(`${String(revealed.num)}${suffix}`)}` : null,
        enactedYear: wasReal && revealed.enacted_date ? String(revealed.enacted_date).slice(0, 4) : null,
        keepCount: wasReal ? Number(revealed.keep_count ?? 0) : null,
        dissolveCount: wasReal ? Number(revealed.dissolve_count ?? 0) : null,
      },
      crowd: { total, fooledPct },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
    if (error instanceof Error && error.message.includes("Load a page")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("guess failed", error);
    return NextResponse.json({ error: "Could not record the guess" }, { status: 500 });
  }
}
