"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dissentShare, readLocalVotes, type LocalVote } from "@/lib/local-history";
import { RHeader } from "@/components/r/header";
import styles from "../reddit.module.css";

export default function HistoryPage() {
  const [votes, setVotes] = useState<LocalVote[] | null>(null);
  // localStorage is only readable after hydration; votes===null doubles as the
  // pre-hydration loading state, so the sync seed here is deliberate.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setVotes(Object.values(readLocalVotes()).sort((a, b) => b.ts - a.ts)); }, []);

  const { hottest, hottestDissent, shareText } = useMemo(() => {
    if (!votes || votes.length === 0) return { hottest: null, hottestDissent: 0, shareText: "" };
    const hottest = votes.reduce((top, vote) => (dissentShare(vote) > dissentShare(top) ? vote : top));
    const hottestDissent = dissentShare(hottest);
    const kept = votes.filter((vote) => vote.direction === "keep").length;
    const shareText = `My EveryLaw record: ${votes.length} section${votes.length === 1 ? "" : "s"} judged — ${kept} kept, ${votes.length - kept} dissolved.${hottestDissent > 0.5 ? ` Hottest take: ${hottest.direction.toUpperCase()} on ${hottest.citation}, against ${Math.round(hottestDissent * 100)}% of voters.` : ""} everylaw.us`;
    return { hottest, hottestDissent, shareText };
  }, [votes]);

  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 2 }}>your record</h1>
        <p className={styles.tagline} style={{ margin: "0 4px 10px" }}>saved in this browser only.</p>
        {votes === null ? <p style={{ padding: 12 }}>loading…</p> : votes.length === 0 ? <p style={{ padding: 12 }} data-testid="history-empty">You haven’t judged any sections in this browser yet. <Link href="/r">Start on the front page →</Link></p> : <>
          {hottest && hottestDissent > 0.5 && <div className={styles.hotTake} data-testid="hottest-take">
            <b>🔥 your hottest take:</b> you said <b>{hottest.direction}</b> on <Link href={hottest.url}>{hottest.citation}</Link> while {Math.round(hottestDissent * 100)}% of voters went the other way.
          </div>}
          <div data-testid="history-list">
            {votes.map((vote) => {
              const dissent = dissentShare(vote);
              return <div className={styles.historyRow} key={vote.id} data-testid={`history-${vote.id}`}>
                <span className={styles.historyVote} data-vote={vote.direction}>{vote.direction === "keep" ? "▲ keep" : "▼ dslv"}</span>
                <span><Link href={vote.url}>{vote.citation} — {vote.heading}</Link></span>
                <span className={styles.dissent}>{dissent > 0.5 ? `against ${Math.round(dissent * 100)}%` : `with ${Math.round((1 - dissent) * 100)}%`} of voters</span>
              </div>;
            })}
          </div>
          <div className={styles.sideBox} style={{ marginTop: 14, maxWidth: 460 }}><h2>share your record</h2><div className={styles.sideBoxBody}>
            <p className={styles.shareBox} data-testid="history-share">{shareText}</p>
          </div></div>
        </>}
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>how this works</h2><div className={styles.sideBoxBody}>
          <p>Every vote you cast is remembered here with the public split at that moment. Your <b>hottest take</b> is where you dissented from the biggest majority.</p>
        </div></div>
      </aside>
    </div>
  </div>;
}
