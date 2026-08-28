import Link from "next/link";
import styles from "@/app/(reader)/reader.module.css";

export type TrialInfo = { day: string; keepCount: number; dissolveCount: number; closed: boolean };

/**
 * Permanent docket record, worn as old-reddit flair: an open row is today's
 * trial, a closed row is the jury's verdict frozen at midnight. Deliberately
 * a snapshot — the flair never updates with later votes.
 */
export function TrialFlair({ trial }: { trial: TrialInfo | null }) {
  if (!trial) return null;
  if (!trial.closed) return <Link href="/docket" className={styles.trialFlair} data-verdict="open">⚖ on trial today</Link>;
  const total = trial.keepCount + trial.dissolveCount;
  const date = new Date(`${trial.day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (total === 0) return <span className={styles.trialFlair} data-verdict="mistrial" title={`stood trial ${date} — no jurors voted`}>⚖ mistrial</span>;
  const keepPct = Math.round((trial.keepCount / total) * 100);
  if (trial.keepCount === trial.dissolveCount) return <span className={styles.trialFlair} data-verdict="hung" title={`stood trial ${date} — ${total.toLocaleString()} jurors split evenly`}>⚖ hung jury 50–50</span>;
  const affirmed = trial.keepCount > trial.dissolveCount;
  return <span className={styles.trialFlair} data-verdict={affirmed ? "affirmed" : "dissolved"} title={`stood trial ${date} — ${total.toLocaleString()} jurors`}>
    ⚖ {affirmed ? `affirmed ${keepPct}–${100 - keepPct}` : `dissolved ${100 - keepPct}–${keepPct}`}
  </span>;
}
