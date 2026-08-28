"use client";

import { useEffect, useRef, useState } from "react";
import { readLocalVotes, recordLocalVote, removeLocalVote } from "@/lib/local-history";
import { directionToVote, emitPostVote, optimisticVoteCounts, type PostVoteCounts, type VoteDirection } from "@/lib/vote-sync";
import styles from "@/app/(reader)/reader.module.css";

type Props = {
  nodeId: number; citation: string; heading: string; url: string;
  keepCount: number; dissolveCount: number;
  size?: "row" | "post";
};

export function VoteArrows({ nodeId, citation, heading, url, keepCount, dissolveCount, size = "row" }: Props) {
  const [counts, setCounts] = useState({ keep: keepCount, dissolve: dissolveCount });
  const [mine, setMine] = useState<VoteDirection>(null);
  const [error, setError] = useState("");
  const countsRef = useRef<PostVoteCounts>({ keepCount, dissolveCount });
  const mineRef = useRef<VoteDirection>(null);
  const sequenceRef = useRef(0);
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());

  function showVote(direction: VoteDirection, nextCounts: PostVoteCounts, remember = true) {
    mineRef.current = direction;
    countsRef.current = nextCounts;
    setMine(direction);
    setCounts({ keep: nextCounts.keepCount, dissolve: nextCounts.dissolveCount });
    emitPostVote(nodeId, directionToVote(direction), nextCounts);
    if (!remember) return;
    if (direction) recordLocalVote({ id: nodeId, citation, heading, url, direction, ...nextCounts, ts: Date.now() });
    else removeLocalVote(nodeId);
  }

  useEffect(() => {
    // Fast local seed for every row; on post pages also ask the server, whose
    // cookie identity outlives localStorage (fresh browser, cleared storage).
    const stored = readLocalVotes()[nodeId];
    // localStorage is only readable after hydration; this one-time sync seed
    // cannot move into initial state without a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) { mineRef.current = stored.direction; setMine(stored.direction); }
    if (size !== "post") return;
    const startingSequence = sequenceRef.current;
    const controller = new AbortController();
    fetch(`/api/vote?nodeId=${nodeId}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      if (sequenceRef.current !== startingSequence) return;
      const direction = result.direction === "keep" || result.direction === "dissolve" ? result.direction : null;
      showVote(direction, result, false);
      if (!direction) removeLocalVote(nodeId);
    }).catch(() => { /* seed stays local */ });
    return () => controller.abort();
    // showVote deliberately stays local to this component instance; changing
    // nodeId or size remounts/reseeds the control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, size]);

  function vote(direction: Exclude<VoteDirection, null>) {
    setError("");
    const previousDirection = mineRef.current;
    const nextDirection = previousDirection === direction ? null : direction;
    const optimisticCounts = optimisticVoteCounts(countsRef.current, previousDirection, nextDirection);
    const sequence = ++sequenceRef.current;
    showVote(nextDirection, optimisticCounts);

    const request = requestQueueRef.current.then(async () => {
      const response = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: nextDirection }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Vote failed");
      if (sequence !== sequenceRef.current) return;
      const confirmedDirection = result.direction === "keep" || result.direction === "dissolve" ? result.direction : null;
      showVote(confirmedDirection, result);
    });
    requestQueueRef.current = request.catch(() => undefined);
    void request.catch(async (cause) => {
      if (sequence !== sequenceRef.current) return;
      setError(cause instanceof Error ? cause.message : "Vote failed");
      try {
        const response = await fetch(`/api/vote?nodeId=${nodeId}`);
        const result = await response.json();
        if (!response.ok || sequence !== sequenceRef.current) return;
        const confirmedDirection = result.direction === "keep" || result.direction === "dissolve" ? result.direction : null;
        showVote(confirmedDirection, result);
      } catch { /* retain the optimistic view until the next server sync */ }
    });
  }

  const score = counts.keep - counts.dissolve;
  return <div className={`${styles.arrows} ${size === "post" ? styles.arrowsPost : ""}`} data-testid={`arrows-${nodeId}`}>
    <button aria-label={`${mine === "keep" ? "Remove Keep vote from" : "Keep"} ${citation}`} data-testid={`arrow-keep-${nodeId}`} aria-pressed={mine === "keep"} className={styles.arrowUp} onClick={() => vote("keep")}>▲</button>
    <b className={styles.score} data-vote={mine ?? undefined} title={`${counts.keep} keep · ${counts.dissolve} dissolve`}>{score.toLocaleString()}</b>
    <button aria-label={`${mine === "dissolve" ? "Remove Dissolve vote from" : "Dissolve"} ${citation}`} data-testid={`arrow-dissolve-${nodeId}`} aria-pressed={mine === "dissolve"} className={styles.arrowDown} onClick={() => vote("dissolve")}>▼</button>
    {error && <span role="alert" className={styles.arrowError}>{error}</span>}
  </div>;
}
