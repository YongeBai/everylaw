"use client";

import { useEffect, useState, type ReactNode } from "react";
import { readLocalVotes } from "@/lib/local-history";
import { onPostVote } from "@/lib/vote-sync";
import styles from "@/app/(reader)/reader.module.css";

type Counts = { keepCount: number; dissolveCount: number };
type Props = Counts & { nodeId: number };
type Mine = "keep" | "dissolve" | null;

/**
 * The split is earned, not given: until this browser has voted on a section,
 * only the turnout shows. Voting reveals the split — and once revealed it
 * stays revealed (information can't be unseen), even if the vote is undone.
 */
function useVoteState({ nodeId, keepCount, dissolveCount }: Props): Counts & { mine: Mine; revealed: boolean } {
  const [counts, setCounts] = useState({ keepCount, dissolveCount });
  const [mine, setMine] = useState<Mine>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const stored = readLocalVotes()[nodeId];
    // localStorage is only readable after hydration; sync seed is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) { setMine(stored.direction); setRevealed(true); }
    return onPostVote((detail) => {
      if (detail.nodeId !== nodeId) return;
      setCounts({ keepCount: detail.keepCount, dissolveCount: detail.dissolveCount });
      setMine(detail.vote === "up" ? "keep" : detail.vote === "down" ? "dissolve" : null);
      if (detail.vote) setRevealed(true);
    });
  }, [nodeId]);

  return { ...counts, mine, revealed };
}

export function VoteTotals({ nodeId, keepCount, dissolveCount, always = false }: Props & { always?: boolean }) {
  const state = useVoteState({ nodeId, keepCount, dissolveCount });
  const total = state.keepCount + state.dissolveCount;
  if (state.revealed) return <span data-testid={`vote-totals-${nodeId}`}> · <span className={styles.keepInk}>{state.keepCount} keep</span> · <span className={styles.dissolveInk}>{state.dissolveCount} dissolve</span></span>;
  if (total === 0) return always ? <span data-testid={`vote-totals-${nodeId}`}> · no verdicts yet</span> : null;
  return <span data-testid={`vote-totals-${nodeId}`}> · {total.toLocaleString()} verdict{total === 1 ? "" : "s"} in{always ? " — vote to see the split" : ""}</span>;
}

function verdictLean(keep: number, dissolve: number): "keep" | "dissolve" | undefined {
  const total = keep + dissolve;
  if (total < 3) return undefined;
  if (keep / total >= 0.6) return "keep";
  if (dissolve / total >= 0.6) return "dissolve";
  return undefined;
}

export function VoteLeanThumb({ nodeId, keepCount, dissolveCount, children }: Props & { children: ReactNode }) {
  const state = useVoteState({ nodeId, keepCount, dissolveCount });
  return <span className={styles.thumb} data-lean={verdictLean(state.keepCount, state.dissolveCount)} aria-hidden>{children}</span>;
}

export function DocketVoteTally({ nodeId, keepCount, dissolveCount }: Props) {
  const state = useVoteState({ nodeId, keepCount, dissolveCount });
  const total = state.keepCount + state.dissolveCount;
  if (!state.revealed) return <div className={styles.trialTallyWrap} data-testid={`vote-totals-${nodeId}`}>
    <p className={styles.trialTallyLabel}><b>{total.toLocaleString()} juror{total === 1 ? "" : "s"} so far — cast your verdict to see where the jury stands</b></p>
  </div>;
  const keepPct = total > 0 ? Math.round((state.keepCount / total) * 100) : 50;
  const mySidePct = state.mine === "keep" ? keepPct : state.mine === "dissolve" ? 100 - keepPct : null;
  return <div className={styles.trialTallyWrap} data-testid={`vote-totals-${nodeId}`}>
    <div className={styles.trialTally} aria-label={`${keepPct}% keep`}><i style={{ width: `${keepPct}%` }} /></div>
    <p className={styles.trialTallyLabel}><span>▲ {state.keepCount.toLocaleString()} keep</span><b>{total.toLocaleString()} jurors so far</b><span>▼ {state.dissolveCount.toLocaleString()} dissolve</span></p>
    {mySidePct !== null && total > 1 && <p className={styles.trialAlignment} data-testid={`alignment-${nodeId}`}>
      {mySidePct >= 50 ? <>you’re with the majority — {mySidePct}% vote {state.mine}</> : <>you dissent — {100 - mySidePct}% went the other way</>}
    </p>}
  </div>;
}
