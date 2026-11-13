import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getAiContent, getCorpusStats, getDefinedTermsInScope, getLaw, getLawNavigation, getTakes, getTermsDefinedByLaw, getTitleInfo, getTitleWikiTerms } from "@/lib/data";
import { getRPosts, searchRPosts, type RPost, type RSort } from "@/lib/reddit-data";
import { getLatestTrial } from "@/lib/trials";
import { CORPUS_TAG, HOME_TAG, lawTag, SEARCH_TAG, titleTag } from "@/lib/cache-tags";

/**
 * Database reads for pages, cached in the Next.js data cache.
 *
 * Why this layer exists: crawlers request a law page every few seconds, and
 * the database bills for every minute it is awake. Entries here survive
 * deployments (a page-level ISR cache does not), so a warm page never wakes
 * the database. Entries have no timer on purpose — with ~50k pages under
 * constant crawl, any TTL turns into a steady trickle of refreshes that keeps
 * the database up. They are purged by tag instead (lib/cache-tags.ts).
 *
 * React cache() on top dedupes generateMetadata + page within one request;
 * unstable_cache alone does not.
 */

/**
 * Part of every cache key. Entries outlive deployments, so code that reads a
 * field older entries don't have would get `undefined` in production while
 * working locally. Bump this whenever the shape of anything returned below
 * changes (including the lib/data.ts mappers these call) — or purge instead:
 * `vercel cache invalidate --tag corpus`.
 */
const V = "v1";

/**
 * Everything on a law page that only changes with the corpus. Keyed by title
 * number so every slug spelling of a title shares one entry.
 */
const loadLawPage = unstable_cache(async (titleNum: number, section: string) => {
  const law = await getLaw(`title-${titleNum}`, section);
  if (!law) return null;
  const [content, navigation, definedTerms, locallyDefinedTerms] = await Promise.all([
    getAiContent(law.id), getLawNavigation(law), getDefinedTermsInScope(law), getTermsDefinedByLaw(law.id),
  ]);
  // The page renders bodyHtml only; dropping the plain-text twin keeps large
  // sections under the cache's 2 MB item limit.
  return { law: { ...law, bodyText: "" }, content, navigation, definedTerms, locallyDefinedTerms };
}, ["law-page", V], { tags: [CORPUS_TAG] });
export const getLawPage = cache(loadLawPage);

/** A law by title number + section param, for resolvers that only need to know where it lives. */
export const getLawCached = cache(unstable_cache(async (titleNum: number, section: string) => {
  const law = await getLaw(`title-${titleNum}`, section);
  return law ? { title: law.title, num: law.num, identifier: law.identifier } : null;
}, ["law-ref", V], { tags: [CORPUS_TAG] }));

/**
 * A law's public, vote-driven state: the split, its arguments (without any
 * viewer's own marks — those load client-side) and its trial record.
 */
export const getLawLive = cache((nodeId: number) => unstable_cache(async () => {
  const [countRows, takes, trial] = await Promise.all([
    db.execute(sql`SELECT keep_count, dissolve_count FROM vote_aggregates WHERE node_id=${nodeId}`),
    getTakes(nodeId),
    getLatestTrial(nodeId),
  ]);
  return { keepCount: Number(countRows[0]?.keep_count ?? 0), dissolveCount: Number(countRows[0]?.dissolve_count ?? 0), takes, trial };
}, ["law-live", V, String(nodeId)], { tags: [lawTag(nodeId)] })());

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * "N votes this week" is relative to when the feed was read. Any new vote in
 * the feed's scope purges it, so an entry older than a week provably has no
 * votes left inside the window.
 */
function expireRecentVotes(entry: { posts: RPost[]; fetchedAt: number }): RPost[] {
  return Date.now() - entry.fetchedAt < WEEK_MS ? entry.posts : entry.posts.map((post) => ({ ...post, recentVotes: 0 }));
}

/** One page of a feed: a title's when titleNum is set, the front page's otherwise. */
export async function getRPostsCached(sort: RSort, titleNum?: number, limit = 25, offset = 0): Promise<RPost[]> {
  const entry = await unstable_cache(
    async () => ({ posts: await getRPosts(sort, titleNum, limit, offset), fetchedAt: Date.now() }),
    ["r-posts", V, sort, String(titleNum ?? "home"), String(limit), String(offset)],
    { tags: [CORPUS_TAG, titleNum ? titleTag(titleNum) : HOME_TAG] },
  )();
  return expireRecentVotes(entry);
}

export async function searchRPostsCached(query: string): Promise<RPost[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const entry = await unstable_cache(
    async () => ({ posts: await searchRPosts(normalized), fetchedAt: Date.now() }),
    ["search", V, normalized],
    { tags: [CORPUS_TAG, SEARCH_TAG] },
  )();
  return expireRecentVotes(entry);
}

export const getTitleInfoCached = cache(unstable_cache((titleNum: number) => getTitleInfo(titleNum), ["title-info", V], { tags: [CORPUS_TAG] }));

export const getCorpusStatsCached = cache(unstable_cache(() => getCorpusStats(), ["corpus-stats", V], { tags: [CORPUS_TAG] }));

export const getTitleWikiTermsCached = unstable_cache(
  (titleNum: number, limit: number, offset: number) => getTitleWikiTerms(titleNum, limit, offset),
  ["title-wiki", V], { tags: [CORPUS_TAG] },
);
