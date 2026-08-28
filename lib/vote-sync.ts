// Client-side bridge between post-vote controls and comment badges: when the
// viewer votes on a law, their own comments on the page flip to match.
export type PostVote = "up" | "down";

const POST_VOTE_EVENT = "everylaw:post-vote";

type Detail = { nodeId: number; vote: PostVote };

export function emitPostVote(nodeId: number, vote: PostVote) {
  window.dispatchEvent(new CustomEvent<Detail>(POST_VOTE_EVENT, { detail: { nodeId, vote } }));
}

export function onPostVote(listener: (detail: Detail) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<Detail>).detail);
  window.addEventListener(POST_VOTE_EVENT, handler);
  return () => window.removeEventListener(POST_VOTE_EVENT, handler);
}

export function directionToVote(direction: unknown): PostVote | null {
  return direction === "keep" ? "up" : direction === "dissolve" ? "down" : null;
}
