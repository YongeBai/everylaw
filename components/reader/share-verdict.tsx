"use client";

import { useEffect, useState } from "react";
import { readLocalVotes } from "@/lib/local-history";
import { onPostVote } from "@/lib/vote-sync";
import styles from "@/app/(reader)/reader.module.css";

type Props = {
  nodeId: number; citation: string; heading: string;
  keepCount: number; dissolveCount: number;
  trialDate: string;
};

/**
 * One-click copy of the day's trial as plain text — the unit of virality is
 * someone pasting a verdict into a post, so the text has to stand alone.
 */
export function ShareVerdict({ nodeId, citation, heading, keepCount, dissolveCount, trialDate }: Props) {
  const [counts, setCounts] = useState({ keepCount, dissolveCount });
  const [mine, setMine] = useState<"keep" | "dissolve" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = readLocalVotes()[nodeId];
    // localStorage is only readable after hydration; sync seed is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setMine(stored.direction);
    return onPostVote((detail) => {
      if (detail.nodeId !== nodeId) return;
      setCounts({ keepCount: detail.keepCount, dissolveCount: detail.dissolveCount });
      setMine(detail.vote === "up" ? "keep" : detail.vote === "down" ? "dissolve" : null);
    });
  }, [nodeId]);

  async function copy() {
    const total = counts.keepCount + counts.dissolveCount;
    const keepPct = total > 0 ? Math.round((counts.keepCount / total) * 100) : 0;
    const lines = [
      `⚖ the ${trialDate} trial — ${citation}: ${heading}`,
      total > 0 ? `the jury so far: ${keepPct}% keep · ${100 - keepPct}% dissolve (${total.toLocaleString()} jurors)` : `the jury is still out`,
      ...(mine ? [`my verdict: ${mine.toUpperCase()}`] : []),
      `serve at everylaw.us/docket`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked: the button simply does nothing */ }
  }

  return <button type="button" className={styles.shareVerdict} data-testid="share-verdict" onClick={copy}>
    {copied ? "copied — paste it somewhere with an audience" : "share the verdict"}
  </button>;
}
