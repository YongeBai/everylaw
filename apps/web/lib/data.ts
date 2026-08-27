import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";

export type LawSummary = {
  id: number; identifier: string; citation: string; num: string; heading: string;
  sortKey: string;
  status: string; featuredTier: number; bodyText: string; bodyHtml: string;
  sourceCredit: string | null; enactingPl: string | null; enactedDate: string | null;
  wordCount: number; amendmentCount: number; title: number;
  keepCount: number; dissolveCount: number; totalCount: number; dissolveRatio: number;
};

function mapLaw(row: Record<string, unknown>): LawSummary {
  return {
    id: Number(row.id), identifier: String(row.identifier), citation: String(row.citation), num: String(row.num), heading: String(row.heading), sortKey: String(row.sort_key),
    status: String(row.status), featuredTier: Number(row.featured_tier), bodyText: String(row.body_text ?? ""), bodyHtml: String(row.body_html ?? ""),
    sourceCredit: row.source_credit ? String(row.source_credit) : null, enactingPl: row.enacting_pl ? String(row.enacting_pl) : null,
    enactedDate: row.enacted_date ? String(row.enacted_date) : null, wordCount: Number(row.word_count), amendmentCount: Number(row.amendment_count),
    title: Number(String(row.identifier).match(/\/t(\d+)/)?.[1] ?? 0), keepCount: Number(row.keep_count ?? 0),
    dissolveCount: Number(row.dissolve_count ?? 0), totalCount: Number(row.total_count ?? 0), dissolveRatio: Number(row.dissolve_ratio ?? 0),
  };
}

const lawSelect = sql.raw(`
  SELECT n.*, COALESCE(v.keep_count,0) keep_count, COALESCE(v.dissolve_count,0) dissolve_count,
    COALESCE(v.total_count,0) total_count, COALESCE(v.dissolve_ratio,0) dissolve_ratio
  FROM law_nodes n LEFT JOIN vote_aggregates v ON v.node_id=n.id
`);

export async function getLaw(title: string, section: string): Promise<LawSummary | null> {
  const titleNum = title.replace(/^title-/, "");
  const variantMatch = section.match(/^(.*)~(\d+)$/); const num = variantMatch?.[1] ?? section; const suffix = variantMatch ? `~${variantMatch[2]}` : "";
  const rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${`/us/usc/t${titleNum}/%`} AND n.num ILIKE ${num} AND (${suffix}='' OR n.identifier LIKE ${`%${suffix}`}) ORDER BY n.identifier LIMIT 1`);
  return rows[0] ? mapLaw(rows[0]) : null;
}

export async function getLawById(id: number): Promise<LawSummary | null> {
  const rows = await db.execute(sql`${lawSelect} WHERE n.id=${id} LIMIT 1`);
  return rows[0] ? mapLaw(rows[0]) : null;
}

export async function getFeatured(limit = 12): Promise<LawSummary[]> {
  const rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.featured_tier >= 1 ORDER BY n.featured_tier DESC, v.total_count DESC NULLS LAST, n.sort_key LIMIT ${limit}`);
  return rows.map(mapLaw);
}

export async function getTitles() {
  const rows = await db.execute(sql`
    SELECT n.id, n.num, n.heading, count(s.id)::int AS section_count
    FROM law_nodes n LEFT JOIN law_nodes s ON s.identifier LIKE n.identifier || '/s%' AND s.node_type='section'
    WHERE n.node_type='title' AND n.identifier ~ '^/us/usc/t[0-9]+$' GROUP BY n.id ORDER BY n.sort_key
  `);
  return rows.map((row) => ({ id: Number(row.id), num: String(row.num), heading: String(row.heading), sectionCount: Number(row.section_count) }));
}

export async function getTitleSections(title: string, limit = 200, offset = 0) {
  const titleNum = title.replace(/^title-/, "");
  const rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${`/us/usc/t${titleNum}/s%`} ORDER BY n.sort_key LIMIT ${limit} OFFSET ${offset}`);
  return rows.map(mapLaw);
}

export async function getTitleSectionCount(title: string) {
  const titleNum = title.replace(/^title-/, ""); const rows = await db.execute(sql`SELECT count(*)::int count FROM law_nodes WHERE node_type='section' AND identifier LIKE ${`/us/usc/t${titleNum}/s%`}`);
  return Number(rows[0]!.count);
}

export async function searchLaws(query: string, limit = 30): Promise<LawSummary[]> {
  if (!query.trim()) return [];
  const rows = await db.execute(sql`${lawSelect}
    WHERE n.node_type='section' AND n.identifier ~ '^/us/usc/t[0-9]+/' AND (
      n.search_document @@ websearch_to_tsquery('english', ${query})
      OR n.heading % ${query} OR n.citation ILIKE ${`%${query}%`}
    )
    ORDER BY ts_rank_cd(n.search_document, websearch_to_tsquery('english', ${query})) DESC,
      similarity(n.heading, ${query}) DESC LIMIT ${limit}`);
  return rows.map(mapLaw);
}

export async function getAiContent(nodeId: number) {
  const rows = await db.execute(sql`SELECT id, content_type, body_md FROM ai_contents WHERE node_id=${nodeId} AND status='published' ORDER BY id DESC`);
  return Object.fromEntries(rows.map((row) => [String(row.content_type), { id: Number(row.id), body: String(row.body_md) }]));
}

export async function getTakes(nodeId: number) {
  const rows = await db.execute(sql`SELECT id, stance, body, upvote_count, downvote_count, parent_id, created_at FROM takes WHERE node_id=${nodeId} AND moderation_status='published' ORDER BY stance, upvote_count DESC, created_at DESC`);
  return rows.map((row) => ({ id: Number(row.id), stance: String(row.stance) as "keep"|"dissolve", body: String(row.body), upvoteCount: Number(row.upvote_count), downvoteCount: Number(row.downvote_count ?? 0), parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id), createdAt: String(row.created_at) }));
}

export async function getRankings(kind: string, limit = 50): Promise<LawSummary[]> {
  const order = kind === "most-loved" ? sql`v.keep_count DESC, v.total_count DESC`
    : kind === "most-contested" ? sql`abs(v.dissolve_ratio - 0.5) ASC, v.total_count DESC`
    : kind === "most-voted" ? sql`v.total_count DESC`
    : sql`v.dissolve_ratio DESC, v.total_count DESC`;
  const rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND COALESCE(v.total_count,0)>0 ORDER BY ${order} LIMIT ${limit}`);
  return rows.map(mapLaw);
}

export async function getTaggedLaws(tag: string, limit = 100): Promise<{ name: string; laws: LawSummary[] } | null> {
  const tagRows = await db.execute(sql`SELECT id, name FROM tags WHERE slug=${tag} LIMIT 1`); if (!tagRows[0]) return null;
  const rows = await db.execute(sql`${lawSelect} JOIN node_tags nt ON nt.node_id=n.id WHERE nt.tag_id=${Number(tagRows[0].id)} ORDER BY n.featured_tier DESC, n.sort_key LIMIT ${limit}`);
  return { name: String(tagRows[0].name), laws: rows.map(mapLaw) };
}

export async function getLawNavigation(law: LawSummary) {
  const prefix = `/us/usc/t${law.title}/s%`;
  const [previousRows, nextRows, relatedRows] = await Promise.all([
    db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.sort_key < ${law.sortKey} ORDER BY n.sort_key DESC LIMIT 1`),
    db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.sort_key > ${law.sortKey} ORDER BY n.sort_key ASC LIMIT 1`),
    db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.id<>${law.id} ORDER BY similarity(n.heading, ${law.heading}) DESC, n.featured_tier DESC LIMIT 3`),
  ]);
  return { previous: previousRows[0] ? mapLaw(previousRows[0]) : null, next: nextRows[0] ? mapLaw(nextRows[0]) : null, related: relatedRows.map(mapLaw) };
}

export function lawUrl(law: Pick<LawSummary, "title"|"num"|"identifier">) { const suffix = law.identifier.match(/(~\d+)$/)?.[1] ?? ""; return `/us/title-${law.title}/${encodeURIComponent(`${law.num}${suffix}`)}`; }
