import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { parseSectionParam, titleFromIdentifier } from "./reddit-format";
import { titleNumberFromSlug } from "./title-names";
import { directionToVote } from "./vote-sync";

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
    title: titleFromIdentifier(String(row.identifier)), keepCount: Number(row.keep_count ?? 0),
    dissolveCount: Number(row.dissolve_count ?? 0), totalCount: Number(row.total_count ?? 0), dissolveRatio: Number(row.dissolve_ratio ?? 0),
  };
}

const VOTE_JOIN = `LEFT JOIN vote_aggregates v ON v.node_id=n.id`;
const VOTE_COLS = `COALESCE(v.keep_count,0) keep_count, COALESCE(v.dissolve_count,0) dissolve_count,
  COALESCE(v.total_count,0) total_count, COALESCE(v.dissolve_ratio,0) dissolve_ratio`;

/** Full row incl. statute bodies — for single-law pages only. */
const lawSelect = sql.raw(`SELECT n.*, ${VOTE_COLS} FROM law_nodes n ${VOTE_JOIN}`);
/** List row without body_text/body_html — bodies are megabytes at list scale. */
const lawSelectLite = sql.raw(`
  SELECT n.id, n.identifier, n.citation, n.num, n.heading, n.sort_key, n.status, n.featured_tier,
    n.source_credit, n.enacting_pl, n.enacted_date, n.word_count, n.amendment_count, ${VOTE_COLS}
  FROM law_nodes n ${VOTE_JOIN}
`);

// cache(): generateMetadata and the page body both call this per request.
export const getLaw = cache(async (title: string, section: string): Promise<LawSummary | null> => {
  const titleNum = titleNumberFromSlug(title);
  if (!titleNum) return null;
  const { num, suffix } = parseSectionParam(section);
  const rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${`/us/usc/t${titleNum}/%`} AND n.num ILIKE ${num} AND (${suffix}='' OR n.identifier LIKE ${`%${suffix}`}) ORDER BY n.identifier LIMIT 1`);
  return rows[0] ? mapLaw(rows[0]) : null;
});

export async function getLawById(id: number): Promise<LawSummary | null> {
  const rows = await db.execute(sql`${lawSelect} WHERE n.id=${id} LIMIT 1`);
  return rows[0] ? mapLaw(rows[0]) : null;
}

export async function getFeatured(limit = 12): Promise<LawSummary[]> {
  const rows = await db.execute(sql`${lawSelectLite} WHERE n.node_type='section' AND n.featured_tier >= 1 ORDER BY n.featured_tier DESC, v.total_count DESC NULLS LAST, n.sort_key LIMIT ${limit}`);
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

/** Heading + section count for one title — two indexed lookups, not the whole catalog. */
export async function getTitleInfo(titleNum: number) {
  const [headingRows, countRows] = await Promise.all([
    db.execute(sql`SELECT heading FROM law_nodes WHERE node_type='title' AND identifier = ${`/us/usc/t${titleNum}`} LIMIT 1`),
    db.execute(sql`SELECT count(*)::int count FROM law_nodes WHERE node_type='section' AND identifier LIKE ${`/us/usc/t${titleNum}/s%`}`),
  ]);
  if (!headingRows[0]) return null;
  return { heading: String(headingRows[0].heading), sectionCount: Number(countRows[0]!.count) };
}

export async function searchLaws(query: string, limit = 30): Promise<LawSummary[]> {
  if (!query.trim()) return [];
  const rows = await db.execute(sql`${lawSelectLite}
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

// A take's side badge is the commenter's current vote on the law, not a stored
// stance — join votes by voter_hash so it stays in sync with vote changes.
export async function getTakes(nodeId: number, viewerHash?: string | null) {
  const rows = await db.execute(sql`SELECT t.id, t.body, t.upvote_count, t.downvote_count, t.parent_id, t.created_at, v.direction, t.voter_hash = ${viewerHash ?? ""} AS mine FROM takes t LEFT JOIN votes v ON v.node_id = t.node_id AND v.voter_hash = t.voter_hash WHERE t.node_id=${nodeId} AND t.moderation_status='published' ORDER BY t.upvote_count DESC, t.created_at DESC`);
  return rows.map((row) => ({ id: Number(row.id), body: String(row.body), upvoteCount: Number(row.upvote_count), downvoteCount: Number(row.downvote_count ?? 0), parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id), createdAt: String(row.created_at), vote: directionToVote(row.direction === null || row.direction === undefined ? null : String(row.direction)), mine: Boolean(row.mine) }));
}

export async function getLawNavigation(law: LawSummary) {
  const prefix = `/us/usc/t${law.title}/s%`;
  const [previousRows, nextRows, relatedRows] = await Promise.all([
    db.execute(sql`${lawSelectLite} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.sort_key < ${law.sortKey} ORDER BY n.sort_key DESC LIMIT 1`),
    db.execute(sql`${lawSelectLite} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.sort_key > ${law.sortKey} ORDER BY n.sort_key ASC LIMIT 1`),
    db.execute(sql`${lawSelectLite} WHERE n.node_type='section' AND n.identifier LIKE ${prefix} AND n.id<>${law.id} ORDER BY similarity(n.heading, ${law.heading}) DESC, n.featured_tier DESC LIMIT 3`),
  ]);
  const previous = previousRows[0] ? mapLaw(previousRows[0]) : null;
  const next = nextRows[0] ? mapLaw(nextRows[0]) : null;
  // The similarity picks can overlap prev/next — don't list a law twice.
  const related = relatedRows.map(mapLaw).filter((item) => item.id !== previous?.id && item.id !== next?.id);
  return { previous, next, related };
}

export { lawUrl } from "./reddit-format";
