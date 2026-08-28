import { sql } from "drizzle-orm";
import { db } from "@/db";
import { VOTE_COLS, VOTE_JOIN } from "@/lib/data";
import { titleFromIdentifier } from "@/lib/reddit-format";
import { HOME_SEED_IDENTIFIERS } from "@/lib/home-seeds";

export type RSort = "hot" | "top" | "controversial" | "dissolved" | "kept" | "order";
export const R_SORTS: { key: RSort; label: string }[] = [
  { key: "hot", label: "hot" },
  { key: "top", label: "top" },
  { key: "controversial", label: "controversial" },
  { key: "dissolved", label: "most dissolved" },
  { key: "kept", label: "most kept" },
  { key: "order", label: "in order" },
];

export const isSort = (value: string): value is RSort => R_SORTS.some((sort) => sort.key === value);

export type RPost = {
  id: number; identifier: string; citation: string; num: string; heading: string; status: string;
  title: number; enactedDate: string | null; enactingPl: string | null;
  keepCount: number; dissolveCount: number;
  commentCount: number; recentVotes: number;
  /** Latest docket appearance: an open row is today's trial, a closed row is a stamped verdict. */
  trial: { day: string; keepCount: number; dissolveCount: number; closed: boolean } | null;
};

/** A postgres `date` may arrive as a Date or a string depending on the driver path. */
function dateKey(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function mapPost(row: Record<string, unknown>): RPost {
  return {
    id: Number(row.id), identifier: String(row.identifier), citation: String(row.citation),
    num: String(row.num), heading: String(row.heading), status: String(row.status),
    title: titleFromIdentifier(String(row.identifier)),
    enactedDate: row.enacted_date ? String(row.enacted_date) : null,
    enactingPl: row.enacting_pl ? String(row.enacting_pl) : null,
    keepCount: Number(row.keep_count ?? 0), dissolveCount: Number(row.dissolve_count ?? 0),
    commentCount: Number(row.comment_count ?? 0), recentVotes: Number(row.recent_votes ?? 0),
    trial: row.trial_day
      ? { day: dateKey(row.trial_day), keepCount: Number(row.trial_keep ?? 0), dissolveCount: Number(row.trial_dissolve ?? 0), closed: Boolean(row.trial_closed) }
      : null,
  };
}

const ORDERS: Record<RSort, ReturnType<typeof sql.raw>> = {
  hot: sql.raw("recent_votes DESC, total_count DESC, n.sort_key"),
  top: sql.raw("total_count DESC, comment_count DESC, n.sort_key"),
  controversial: sql.raw("(CASE WHEN COALESCE(v.total_count,0) >= 3 THEN abs(COALESCE(v.dissolve_ratio,0.5) - 0.5) ELSE 1 END) ASC, total_count DESC"),
  dissolved: sql.raw("dissolve_count DESC, total_count DESC, n.sort_key"),
  kept: sql.raw("keep_count DESC, total_count DESC, n.sort_key"),
  // The code's own order: title, then chapter/section as Congress publishes them.
  order: sql.raw("n.sort_key"),
};

const POST_SELECT = sql.raw(`
  SELECT n.id, n.identifier, n.citation, n.num, n.heading, n.status, n.enacted_date, n.enacting_pl,
    ${VOTE_COLS},
    COALESCE(t.cnt,0) comment_count, COALESCE(r.cnt,0) recent_votes,
    tr.trial_day, tr.trial_keep, tr.trial_dissolve, tr.trial_closed
  FROM law_nodes n
  ${VOTE_JOIN}
  LEFT JOIN LATERAL (SELECT count(*)::int cnt FROM takes WHERE node_id = n.id AND moderation_status='published') t ON true
  LEFT JOIN LATERAL (SELECT count(*)::int cnt FROM votes WHERE node_id = n.id AND updated_at > now() - interval '7 days') r ON true
  LEFT JOIN LATERAL (SELECT day_key trial_day, keep_count trial_keep, dissolve_count trial_dissolve, (closed_at IS NOT NULL) trial_closed FROM trials WHERE node_id = n.id ORDER BY day_key DESC LIMIT 1) tr ON true`);

export async function getRPosts(sort: RSort, titleNum?: number, limit = 25, offset = 0): Promise<RPost[]> {
  const seedList = sql.join(HOME_SEED_IDENTIFIERS.map((identifier) => sql`${identifier}`), sql`, `);
  const isSeed = sql`n.identifier IN (${seedList})`;
  const scope = titleNum
    ? sql`n.identifier LIKE ${"/us/usc/t" + titleNum + "/%"}`
    : sql`(COALESCE(v.total_count,0) > 0 OR ${isSeed})`;
  const order = sort === "hot" && !titleNum
    ? sql`
      CASE
        WHEN COALESCE(r.cnt,0) >= 3 THEN 0
        WHEN ${isSeed} THEN 1
        WHEN COALESCE(r.cnt,0) > 0 THEN 2
        ELSE 3
      END,
      CASE WHEN COALESCE(r.cnt,0) >= 3 THEN r.cnt ELSE 0 END DESC,
      array_position(ARRAY[${seedList}]::text[], n.identifier) ASC NULLS LAST,
      COALESCE(v.total_count,0) DESC,
      n.sort_key`
    : ORDERS[sort];
  const rows = await db.execute(sql`
    ${POST_SELECT}
    WHERE n.node_type = 'section' AND ${scope}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return rows.map(mapPost);
}

// Search results render through the same PostList as title/front pages, so
// they carry the same fields (comment counts, weekly votes) as any feed row.
export async function searchRPosts(query: string, limit = 30): Promise<RPost[]> {
  if (!query.trim()) return [];
  const rows = await db.execute(sql`
    ${POST_SELECT}
    WHERE n.node_type = 'section' AND n.identifier ~ '^/us/usc/t[0-9]+/' AND (
      n.search_document @@ websearch_to_tsquery('english', ${query})
      OR n.heading % ${query} OR n.citation ILIKE ${`%${query}%`}
    )
    ORDER BY ts_rank_cd(n.search_document, websearch_to_tsquery('english', ${query})) DESC,
      similarity(n.heading, ${query}) DESC
    LIMIT ${limit}
  `);
  return rows.map(mapPost);
}
