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

// Parsed once per page: 25 list rows shouldn't JSON.parse the same blob 25×.
let cached: Record<number, LocalVote> | null = null;

export function readLocalVotes(): Record<number, LocalVote> {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Record<number, LocalVote>) : {};
  } catch {
    cached = {};
  }
  return cached;
}

export function recordLocalVote(vote: LocalVote): void {
  try {
    const all = { ...readLocalVotes(), [vote.id]: vote };
    cached = all;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable (private mode etc.) — the site works without it */
  }
}

export function removeLocalVote(nodeId: number): void {
  try {
    const all = { ...readLocalVotes() };
    delete all[nodeId];
    cached = all;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — the server-side vote is still removed */
  }
}

/** Share of the public that voted AGAINST you at the time you voted (0–1). */
export function dissentShare(vote: LocalVote): number {
  const total = vote.keepCount + vote.dissolveCount;
  if (total === 0) return 0;
  const against = vote.direction === "keep" ? vote.dissolveCount : vote.keepCount;
  return against / total;
}
