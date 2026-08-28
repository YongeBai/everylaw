// Client-side bridge between post-vote controls and every other live view of
// that vote: totals, verdict styling, docket tallies, and comment badges.
export type PostVote = "up" | "down";
export type PostVoteCounts = { keepCount: number; dissolveCount: number };
export type VoteDirection = "keep" | "dissolve" | null;
export type TakeVoteDirection = 1 | -1 | null;
export type TakeVoteCounts = { upvoteCount: number; downvoteCount: number };

const POST_VOTE_EVENT = "everylaw:post-vote";

type Detail = { nodeId: number; vote: PostVote | null } & PostVoteCounts;

export function emitPostVote(nodeId: number, vote: PostVote | null, counts: PostVoteCounts) {
  window.dispatchEvent(new CustomEvent<Detail>(POST_VOTE_EVENT, { detail: { nodeId, vote, ...counts } }));
}

export function onPostVote(listener: (detail: Detail) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<Detail>).detail);
  window.addEventListener(POST_VOTE_EVENT, handler);
  return () => window.removeEventListener(POST_VOTE_EVENT, handler);
}

export function directionToVote(direction: unknown): PostVote | null {
  return direction === "keep" ? "up" : direction === "dissolve" ? "down" : null;
}

/** Apply one viewer's vote transition without waiting for the server. */
export function optimisticVoteCounts(counts: PostVoteCounts, previous: VoteDirection, next: VoteDirection): PostVoteCounts {
  let { keepCount, dissolveCount } = counts;
  if (previous === "keep") keepCount -= 1;
  if (previous === "dissolve") dissolveCount -= 1;
  if (next === "keep") keepCount += 1;
  if (next === "dissolve") dissolveCount += 1;
  return { keepCount: Math.max(0, keepCount), dissolveCount: Math.max(0, dissolveCount) };
}

export function optimisticTakeVoteCounts(counts: TakeVoteCounts, previous: TakeVoteDirection, next: TakeVoteDirection): TakeVoteCounts {
  let { upvoteCount, downvoteCount } = counts;
  if (previous === 1) upvoteCount -= 1;
  if (previous === -1) downvoteCount -= 1;
  if (next === 1) upvoteCount += 1;
  if (next === -1) downvoteCount += 1;
  return { upvoteCount: Math.max(0, upvoteCount), downvoteCount: Math.max(0, downvoteCount) };
}
