import { revalidateTag } from "next/cache";
import type { NextResponse } from "next/server";
import { DOCKET_TAG, HOME_TAG, lawTag, SEARCH_TAG, titleTag } from "@/lib/cache-tags";
import { ACTIVE_COOKIE } from "@/lib/vote-sync";

// Expire at once rather than serve stale: the person who just voted navigates
// next, and must see their vote counted.
const NOW = { expire: 0 } as const;

/**
 * A vote or argument changed a law's public numbers: drop every cached view
 * that shows them. `feeds: false` for changes feeds don't display (votes on an
 * argument).
 */
export function revalidateLawActivity(nodeId: number, titleNum: number | null, { feeds = true } = {}) {
  revalidateTag(lawTag(nodeId), NOW);
  revalidateTag(DOCKET_TAG, NOW);
  if (!feeds) return;
  if (titleNum) revalidateTag(titleTag(titleNum), NOW);
  revalidateTag(HOME_TAG, NOW);
  revalidateTag(SEARCH_TAG, NOW);
}

/**
 * Cached pages carry no per-viewer state, so the client asks for it — but only
 * once this cookie says the browser has ever voted or argued. Everyone else,
 * crawlers included, never triggers a per-view database query.
 */
export function markActiveViewer<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.set(ACTIVE_COOKIE, "1", { sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
  return response;
}
