/**
 * Tags on cached data (lib/cached.ts) and on the pages rendered from it.
 * Nothing here expires on a timer: an entry lives until its tag is purged, so
 * a warm page costs zero database queries and the database can sleep.
 */

/** Law text, AI content, defined terms. Purge after any ingest or publish: `vercel cache invalidate --tag corpus`. */
export const CORPUS_TAG = "corpus";
/** Front-page feeds. */
export const HOME_TAG = "home";
/** Today's trial. */
export const DOCKET_TAG = "docket";
/** Search results (they carry vote counts). */
export const SEARCH_TAG = "search";
/** One law's votes, arguments and trial flair. */
export const lawTag = (nodeId: number) => `law:${nodeId}`;
/** One title's feeds. */
export const titleTag = (titleNum: number) => `title:${titleNum}`;
