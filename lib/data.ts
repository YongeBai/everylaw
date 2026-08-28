import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { parseSectionParam, titleFromIdentifier } from "./reddit-format";
import { titleNumberFromSlug } from "./title-names";
import { directionToVote } from "./vote-sync";

export type LawSummary = {
  id: number; identifier: string; citation: string; num: string; heading: string;
  sortKey: string; levelPath: string | null;
  status: string; featuredTier: number; bodyText: string; bodyHtml: string;
  sourceCredit: string | null; enactingPl: string | null; enactedDate: string | null;
  wordCount: number; title: number;
  keepCount: number; dissolveCount: number; totalCount: number; dissolveRatio: number;
};

function mapLaw(row: Record<string, unknown>): LawSummary {
  return {
    id: Number(row.id), identifier: String(row.identifier), citation: String(row.citation), num: String(row.num), heading: String(row.heading), sortKey: String(row.sort_key),
    levelPath: row.level_path ? String(row.level_path) : null,
    status: String(row.status), featuredTier: Number(row.featured_tier), bodyText: String(row.body_text ?? ""), bodyHtml: String(row.body_html ?? ""),
    sourceCredit: row.source_credit ? String(row.source_credit) : null, enactingPl: row.enacting_pl ? String(row.enacting_pl) : null,
    enactedDate: row.enacted_date ? String(row.enacted_date) : null, wordCount: Number(row.word_count),
    title: titleFromIdentifier(String(row.identifier)), keepCount: Number(row.keep_count ?? 0),
    dissolveCount: Number(row.dissolve_count ?? 0), totalCount: Number(row.total_count ?? 0), dissolveRatio: Number(row.dissolve_ratio ?? 0),
  };
}

export const VOTE_JOIN = `LEFT JOIN vote_aggregates v ON v.node_id=n.id`;
export const VOTE_COLS = `COALESCE(v.keep_count,0) keep_count, COALESCE(v.dissolve_count,0) dissolve_count,
  COALESCE(v.total_count,0) total_count, COALESCE(v.dissolve_ratio,0) dissolve_ratio`;

/** Full row incl. statute bodies — for single-law pages only. */
const lawSelect = sql.raw(`SELECT n.*, ${VOTE_COLS} FROM law_nodes n ${VOTE_JOIN}`);
/** List row without body_text/body_html — bodies are megabytes at list scale. */
const lawSelectLite = sql.raw(`
  SELECT n.id, n.identifier, n.citation, n.num, n.heading, n.sort_key, n.status, n.featured_tier,
    n.source_credit, n.enacting_pl, n.enacted_date, n.word_count, ${VOTE_COLS}
  FROM law_nodes n ${VOTE_JOIN}
`);

// cache(): generateMetadata and the page body both call this per request.
export const getLaw = cache(async (title: string, section: string): Promise<LawSummary | null> => {
  const titleNum = titleNumberFromSlug(title);
  if (!titleNum) return null;
  const { num, suffix } = parseSectionParam(section);
  let rows = await db.execute(sql`${lawSelect} WHERE n.node_type='section' AND n.identifier LIKE ${`/us/usc/t${titleNum}/%`} AND n.num ILIKE ${num} AND (${suffix}='' OR n.identifier LIKE ${`%${suffix}`}) ORDER BY n.identifier LIMIT 1`);
  // The Code sometimes stores a run of repealed sections as one record (for
  // example Title 21 "§ 1 to 5"). A citation to any member resolves to it.
  if (!rows[0] && /^\d+$/.test(num) && suffix === "") {
    const requested = Number(num);
    rows = await db.execute(sql`${lawSelect}
      WHERE n.node_type='section' AND n.identifier LIKE ${`/us/usc/t${titleNum}/%`}
        AND n.num ~ '^[0-9]+ to [0-9]+$'
        AND split_part(n.num, ' ', 1)::int <= ${requested}
        AND split_part(n.num, ' ', 3)::int >= ${requested}
      ORDER BY n.sort_key LIMIT 1`);
  }
  return rows[0] ? mapLaw(rows[0]) : null;
});

export async function getLawById(id: number): Promise<LawSummary | null> {
  const rows = await db.execute(sql`${lawSelect} WHERE n.id=${id} LIMIT 1`);
  return rows[0] ? mapLaw(rows[0]) : null;
}

/** Like getLawById but without the statute bodies — for stat-only consumers (OG images, verdict recaps). */
export async function getLawLiteById(id: number): Promise<LawSummary | null> {
  const rows = await db.execute(sql`${lawSelectLite} WHERE n.id=${id} LIMIT 1`);
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

export type DefinedTerm = {
  id: number; term: string; definition: string;
  scopeType: string; // 'title' | 'chapter' | … — how far the definition reaches
  citation: string; num: string; heading: string | null; identifier: string; title: number;
};

function mapDefinedTerm(row: Record<string, unknown>): DefinedTerm {
  return {
    id: Number(row.id), term: String(row.term), definition: String(row.definition_text),
    scopeType: String(row.scope_type), citation: String(row.citation), num: String(row.num),
    heading: row.heading ? String(row.heading) : null, identifier: String(row.identifier),
    title: titleFromIdentifier(String(row.identifier)),
  };
}

/**
 * Statutory defined terms that reach `law` from an ancestor scope (title,
 * chapter, …) — the ones worth starring in its text. Terms the section defines
 * itself are excluded (no self-stars, and a local redefinition wins over an
 * inherited one). Narrowest scope first so the JS dedupe keeps it.
 */
export async function getDefinedTermsInScope(law: LawSummary): Promise<DefinedTerm[]> {
  if (!law.levelPath) return [];
  const rows = await db.execute(sql`
    SELECT dt.id, dt.term, dt.definition_text, s.node_type AS scope_type,
      d.citation, d.num, d.heading, d.identifier
    FROM defined_terms dt
    JOIN law_nodes s ON s.id = dt.scope_node_id
    JOIN law_nodes d ON d.id = dt.node_id
    WHERE dt.node_id <> ${law.id} AND d.status = 'active'
      AND ${law.levelPath} LIKE s.level_path || '.%'
      AND lower(dt.term) NOT IN (SELECT lower(term) FROM defined_terms WHERE node_id = ${law.id})
    ORDER BY length(s.level_path) DESC, length(dt.term) DESC
    LIMIT 300`);
  const seen = new Set<string>();
  return rows.map(mapDefinedTerm).filter((term) => {
    const key = term.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Term names this section defines itself, used to suppress self-annotations. */
export async function getTermsDefinedByLaw(nodeId: number): Promise<string[]> {
  const rows = await db.execute(sql`SELECT DISTINCT term FROM defined_terms WHERE node_id = ${nodeId}`);
  return rows.map((row) => String(row.term));
}

export type WikiSection = {
  citation: string; num: string; heading: string | null; identifier: string; title: number;
  terms: { id: number; term: string; definition: string; scopeType: string; scopeCitation: string | null }[];
};

/** One wiki page of a title's defined terms, grouped by defining section in reading order. */
export async function getTitleWikiTerms(titleNum: number, limit: number, offset: number) {
  const prefix = `/us/usc/t${titleNum}/s%`;
  const [countRows, rows] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS count FROM defined_terms dt JOIN law_nodes d ON d.id = dt.node_id
      WHERE d.identifier LIKE ${prefix} AND d.status = 'active'`),
    db.execute(sql`
      SELECT dt.id, dt.term, dt.definition_text, s.node_type AS scope_type, s.citation AS scope_citation,
        d.citation, d.num, d.heading, d.identifier
      FROM defined_terms dt
      JOIN law_nodes d ON d.id = dt.node_id
      JOIN law_nodes s ON s.id = dt.scope_node_id
      WHERE d.identifier LIKE ${prefix} AND d.status = 'active'
      ORDER BY d.sort_key, lower(dt.term) LIMIT ${limit} OFFSET ${offset}`),
  ]);
  const sections: WikiSection[] = [];
  for (const row of rows) {
    const identifier = String(row.identifier);
    let section = sections[sections.length - 1];
    if (!section || section.identifier !== identifier) {
      section = {
        citation: String(row.citation), num: String(row.num),
        heading: row.heading ? String(row.heading) : null,
        identifier, title: titleFromIdentifier(identifier), terms: [],
      };
      sections.push(section);
    }
    section.terms.push({
      id: Number(row.id), term: String(row.term), definition: String(row.definition_text),
      scopeType: String(row.scope_type), scopeCitation: row.scope_citation ? String(row.scope_citation) : null,
    });
  }
  return { termCount: Number(countRows[0]!.count), sections };
}

// A take's side badge is the commenter's current vote on the law, not a stored
// stance — join votes by voter_hash so it stays in sync with vote changes.
export async function getTakes(nodeId: number, viewerHash?: string | null) {
  const rows = await db.execute(sql`SELECT t.id, t.body, t.upvote_count, t.downvote_count, t.parent_id, t.created_at, v.direction, tv.direction AS viewer_vote, t.voter_hash = ${viewerHash ?? ""} AS mine FROM takes t LEFT JOIN votes v ON v.node_id = t.node_id AND v.voter_hash = t.voter_hash LEFT JOIN take_votes tv ON tv.take_id=t.id AND tv.voter_hash=${viewerHash ?? ""} WHERE t.node_id=${nodeId} AND t.moderation_status='published' ORDER BY t.upvote_count DESC, t.created_at DESC`);
  return rows.map((row) => ({ id: Number(row.id), body: String(row.body), upvoteCount: Number(row.upvote_count), downvoteCount: Number(row.downvote_count ?? 0), parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id), createdAt: String(row.created_at), vote: directionToVote(row.direction === null || row.direction === undefined ? null : String(row.direction)), myVote: row.viewer_vote === 1 || row.viewer_vote === "1" ? 1 as const : row.viewer_vote === -1 || row.viewer_vote === "-1" ? -1 as const : null, mine: Boolean(row.mine) }));
}

/** Live corpus stats for the homepage sidebar — one aggregate, request-cached. */
export const getCorpusStats = cache(async () => {
  const rows = await db.execute(sql`SELECT
    count(*) FILTER (WHERE node_type='section' AND status='active')::int sections_in_force,
    count(*) FILTER (WHERE node_type='title')::int titles
    FROM law_nodes`);
  return { sectionsInForce: Number(rows[0]!.sections_in_force), titles: Number(rows[0]!.titles) };
});

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
