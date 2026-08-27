"use client";

/**
 * Account-less personal layer, kept in this browser only (localStorage).
 * Records each keep/dissolve vote with the public split at the time, so the
 * history page can show what you judged and where you dissented hardest.
 */
export type LocalVote = {
  id: number; citation: string; heading: string; url: string;
  direction: "keep" | "dissolve";
  keepCount: number; dissolveCount: number;
  ts: number;
};

const KEY = "everylaw:votes";

export function readLocalVotes(): Record<number, LocalVote> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<number, LocalVote>) : {};
  } catch {
    return {};
  }
}

export function recordLocalVote(vote: LocalVote): void {
  try {
    const all = readLocalVotes();
    all[vote.id] = vote;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable (private mode etc.) — the site works without it */
  }
}

/** Share of the public that voted AGAINST you at the time you voted (0–1). */
export function dissentShare(vote: LocalVote): number {
  const total = vote.keepCount + vote.dissolveCount;
  if (total === 0) return 0;
  const against = vote.direction === "keep" ? vote.dissolveCount : vote.keepCount;
  return against / total;
}
