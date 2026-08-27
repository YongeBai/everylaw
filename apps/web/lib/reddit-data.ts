import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";

export type RSort = "hot" | "top" | "controversial" | "dissolved" | "kept";
export const R_SORTS: { key: RSort; label: string }[] = [
  { key: "hot", label: "hot" },
  { key: "top", label: "top" },
  { key: "controversial", label: "controversial" },
  { key: "dissolved", label: "most dissolved" },
  { key: "kept", label: "most kept" },
];

export type RPost = {
  id: number; identifier: string; citation: string; num: string; heading: string; status: string;
  title: number; wordCount: number; enactedDate: string | null; enactingPl: string | null;
  keepCount: number; dissolveCount: number; totalCount: number; dissolveRatio: number;
  commentCount: number; recentVotes: number;
};

function mapPost(row: Record<string, unknown>): RPost {
  return {
    id: Number(row.id), identifier: String(row.identifier), citation: String(row.citation),
    num: String(row.num), heading: String(row.heading), status: String(row.status),
    title: Number(String(row.identifier).match(/\/t(\d+)/)?.[1] ?? 0),
    wordCount: Number(row.word_count), enactedDate: row.enacted_date ? String(row.enacted_date) : null,
    enactingPl: row.enacting_pl ? String(row.enacting_pl) : null,
    keepCount: Number(row.keep_count ?? 0), dissolveCount: Number(row.dissolve_count ?? 0),
    totalCount: Number(row.total_count ?? 0), dissolveRatio: Number(row.dissolve_ratio ?? 0),
    commentCount: Number(row.comment_count ?? 0), recentVotes: Number(row.recent_votes ?? 0),
  };
}

const ORDERS: Record<RSort, ReturnType<typeof sql.raw>> = {
  hot: sql.raw("recent_votes DESC, total_count DESC, n.sort_key"),
  top: sql.raw("total_count DESC, comment_count DESC, n.sort_key"),
  controversial: sql.raw("(CASE WHEN COALESCE(v.total_count,0) >= 3 THEN abs(COALESCE(v.dissolve_ratio,0.5) - 0.5) ELSE 1 END) ASC, total_count DESC"),
  dissolved: sql.raw("dissolve_count DESC, total_count DESC, n.sort_key"),
  kept: sql.raw("keep_count DESC, total_count DESC, n.sort_key"),
};

export async function getRPosts(sort: RSort, titleNum?: number, limit = 25): Promise<RPost[]> {
  const scope = titleNum
    ? sql`n.identifier LIKE ${"/us/usc/t" + titleNum + "/%"}`
    : sql`(COALESCE(v.total_count,0) > 0 OR n.featured_tier >= 1)`;
  const rows = await db.execute(sql`
    SELECT n.id, n.identifier, n.citation, n.num, n.heading, n.status, n.word_count, n.enacted_date, n.enacting_pl,
      COALESCE(v.keep_count,0) keep_count, COALESCE(v.dissolve_count,0) dissolve_count,
      COALESCE(v.total_count,0) total_count, COALESCE(v.dissolve_ratio,0) dissolve_ratio,
      COALESCE(t.cnt,0) comment_count, COALESCE(r.cnt,0) recent_votes
    FROM law_nodes n
    LEFT JOIN vote_aggregates v ON v.node_id = n.id
    LEFT JOIN LATERAL (SELECT count(*)::int cnt FROM takes WHERE node_id = n.id AND moderation_status='published') t ON true
    LEFT JOIN LATERAL (SELECT count(*)::int cnt FROM votes WHERE node_id = n.id AND updated_at > now() - interval '7 days') r ON true
    WHERE n.node_type = 'section' AND ${scope}
    ORDER BY ${ORDERS[sort]}
    LIMIT ${limit}
  `);
  return rows.map(mapPost);
}

export async function getCommentCount(nodeId: number): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int cnt FROM takes WHERE node_id=${nodeId} AND moderation_status='published'`);
  return Number(rows[0]?.cnt ?? 0);
}

export { agePhrase, officialSourceUrl } from "@/lib/reddit-format";
import { rPostUrlFrom } from "@/lib/reddit-format";

export function rPostUrl(post: Pick<RPost, "title" | "num" | "identifier">): string {
  return rPostUrlFrom(post.title, post.num, post.identifier);
}
