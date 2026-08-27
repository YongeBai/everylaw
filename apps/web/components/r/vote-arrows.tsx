"use client";

import { useEffect, useState } from "react";
import { readLocalVotes, recordLocalVote } from "@/lib/local-history";
import { emitPostVote } from "@/lib/vote-sync";
import styles from "@/app/r/reddit.module.css";

type Props = {
  nodeId: number; citation: string; heading: string; url: string;
  keepCount: number; dissolveCount: number;
  size?: "row" | "post";
};

export function VoteArrows({ nodeId, citation, heading, url, keepCount, dissolveCount, size = "row" }: Props) {
  const [counts, setCounts] = useState({ keep: keepCount, dissolve: dissolveCount });
  const [mine, setMine] = useState<"keep" | "dissolve" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fast local seed for every row; on post pages also ask the server, whose
    // cookie identity outlives localStorage (fresh browser, cleared storage).
    const stored = readLocalVotes()[nodeId];
    if (stored) setMine(stored.direction);
    if (size !== "post") return;
    const controller = new AbortController();
    fetch(`/api/vote?nodeId=${nodeId}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      setCounts({ keep: result.keepCount, dissolve: result.dissolveCount });
      if (result.direction === "keep" || result.direction === "dissolve") setMine(result.direction);
    }).catch(() => { /* seed stays local */ });
    return () => controller.abort();
  }, [nodeId, size]);

  async function vote(direction: "keep" | "dissolve") {
    setError("");
    const response = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Vote failed"); return; }
    setCounts({ keep: result.keepCount, dissolve: result.dissolveCount });
    setMine(direction);
    emitPostVote(nodeId, direction === "keep" ? "up" : "down");
    recordLocalVote({ id: nodeId, citation, heading, url, direction, keepCount: result.keepCount, dissolveCount: result.dissolveCount, ts: Date.now() });
  }

  const score = counts.keep - counts.dissolve;
  return <div className={`${styles.arrows} ${size === "post" ? styles.arrowsPost : ""}`} data-testid={`arrows-${nodeId}`}>
    <button aria-label={`Keep ${citation}`} data-testid={`arrow-keep-${nodeId}`} aria-pressed={mine === "keep"} className={styles.arrowUp} onClick={() => vote("keep")}>▲</button>
    <b className={styles.score} data-vote={mine ?? undefined} title={`${counts.keep} keep · ${counts.dissolve} dissolve`}>{score.toLocaleString()}</b>
    <button aria-label={`Dissolve ${citation}`} data-testid={`arrow-dissolve-${nodeId}`} aria-pressed={mine === "dissolve"} className={styles.arrowDown} onClick={() => vote("dissolve")}>▼</button>
    {error && <span role="alert" className={styles.arrowError}>{error}</span>}
  </div>;
}
