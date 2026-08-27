/**
 * Today's-trial design switch. Two candidates, easy to swap or remove:
 *
 *  "classic" — the day's law rendered exactly like any other law post
 *              (redirects to its /r page with a small trial banner).
 *              Implementation: the redirect in page.tsx + the banner in
 *              app/r/[titleSlug]/[section]/page.tsx.
 *
 *  "trial"   — a dedicated old-reddit-style trial layout, distinct from the
 *              normal post. Implementation: docket-trial.tsx.
 *
 * To choose a winner: set it here, delete the loser's file, and inline the
 * survivor into page.tsx.
 */
export const DOCKET_DESIGN: "classic" | "trial" = "trial";
