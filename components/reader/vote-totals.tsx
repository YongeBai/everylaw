"use client";

import { useEffect, useState, type ReactNode } from "react";
import { onPostVote } from "@/lib/vote-sync";
import styles from "@/app/(reader)/reader.module.css";

type Counts = { keepCount: number; dissolveCount: number };
type Props = Counts & { nodeId: number };

function useVoteCounts({ nodeId, keepCount, dissolveCount }: Props): Counts {
  const [counts, setCounts] = useState({ keepCount, dissolveCount });

  useEffect(() => onPostVote((detail) => {
    if (detail.nodeId === nodeId) setCounts({ keepCount: detail.keepCount, dissolveCount: detail.dissolveCount });
  }), [nodeId]);

  return counts;
}

export function VoteTotals({ nodeId, keepCount, dissolveCount, always = false }: Props & { always?: boolean }) {
  const counts = useVoteCounts({ nodeId, keepCount, dissolveCount });
  if (!always && counts.keepCount + counts.dissolveCount === 0) return null;
  return <span data-testid={`vote-totals-${nodeId}`}> · <span className={styles.keepInk}>{counts.keepCount} keep</span> · <span className={styles.dissolveInk}>{counts.dissolveCount} dissolve</span></span>;
}

function verdictLean(keep: number, dissolve: number): "keep" | "dissolve" | undefined {
  const total = keep + dissolve;
  if (total < 3) return undefined;
  if (keep / total >= 0.6) return "keep";
  if (dissolve / total >= 0.6) return "dissolve";
  return undefined;
}

export function VoteLeanThumb({ nodeId, keepCount, dissolveCount, children }: Props & { children: ReactNode }) {
  const counts = useVoteCounts({ nodeId, keepCount, dissolveCount });
  return <span className={styles.thumb} data-lean={verdictLean(counts.keepCount, counts.dissolveCount)} aria-hidden>{children}</span>;
}

export function DocketVoteTally({ nodeId, keepCount, dissolveCount }: Props) {
  const counts = useVoteCounts({ nodeId, keepCount, dissolveCount });
  const total = counts.keepCount + counts.dissolveCount;
  const keepPct = total > 0 ? Math.round((counts.keepCount / total) * 100) : 50;
  return <div className={styles.trialTallyWrap} data-testid={`vote-totals-${nodeId}`}>
    <div className={styles.trialTally} aria-label={`${keepPct}% keep`}><i style={{ width: `${keepPct}%` }} /></div>
    <p className={styles.trialTallyLabel}><span>▲ {counts.keepCount.toLocaleString()} keep</span><b>{total.toLocaleString()} jurors so far</b><span>▼ {counts.dissolveCount.toLocaleString()} dissolve</span></p>
  </div>;
}
