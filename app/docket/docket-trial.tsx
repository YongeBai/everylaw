import Link from "next/link";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { parseHistory } from "@/lib/history";
import { highlightTerms } from "@/lib/terms";
import { RHeader } from "@/components/r/header";
import { VoteArrows } from "@/components/r/vote-arrows";
import { OfficialText } from "@/components/r/official-text";
import { Comments } from "@/components/r/comments";
import type { Docket } from "./pick";
import styles from "@/app/r/reddit.module.css";

/** Experimental docket design: old-reddit vernacular, distinct from a normal post. */
export function DocketTrial({ docket }: { docket: Docket }) {
  const { law, summary, explanation, origin, takes, yesterday, todayKey } = docket;
  const url = lawUrl(law);
  const trialDate = new Date(`${todayKey}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const total = law.keepCount + law.dissolveCount;
  const keepPct = total > 0 ? Math.round((law.keepCount / total) * 100) : 50;
  const history = parseHistory(law.sourceCredit);

  return <div className={styles.page}>
    <RHeader />
    <div className={styles.trialStage}>
      <section className={styles.trialBox} data-testid="docket-trial">
        <div className={styles.trialSticky}>⚖ {trialDate} trial<span className={styles.trialStickyRight}>new section is up for trial at midnight PST</span></div>
        <div className={styles.trialInner}>
          <p className={styles.tagline}>submitted {agePhrase(law.enactedDate)} by {law.enactingPl ?? "Congress"} to <Link href={subredditUrl(law.title)}>r/{subredditSlug(law.title)}</Link></p>
          <h1 className={styles.trialTitle}><Link href={url}>{law.citation} — {law.heading}</Link></h1>
          {summary
            ? <p className={styles.trialSummary}>{summary}</p>
            : <p className={styles.trialSummary}>{law.bodyText.slice(0, 420)}{law.bodyText.length > 420 ? "…" : ""}</p>}
          <details className={styles.trialMore}>
            <summary data-testid="trial-show-more">show more</summary>
            {explanation && <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>in plain english</div>
              <div className={styles.sectionBody}><div className={styles.translationBody}>{explanation}</div></div>
            </div>}
            <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>the actual law <a href={officialSourceUrl(law.title, law.num)} target="_blank" rel="noopener">source ↗</a></div>
              <div className={styles.sectionBody}><OfficialText html={highlightTerms(law.bodyHtml)} /></div>
            </div>
            {(history.length > 0 || origin) && <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>history</div>
              <div className={styles.sectionBody}>
                {history.length > 0 && <ul className={styles.historyList}>{history.map((entry, index) => <li key={index}><b>{entry.year ?? "—"}</b><span>{entry.kind === "enacted" ? "Enacted" : "Amended"} · {entry.act}</span></li>)}</ul>}
                {origin && <div className={styles.translationBody} style={{ marginTop: history.length ? 10 : 0 }}>{origin}</div>}
              </div>
            </div>}
          </details>
          <p className={styles.buttons} style={{ marginTop: 8 }}>
            <Link href={url}>view section</Link>
          </p>
          <div className={styles.trialVerdict}>
            <VoteArrows nodeId={law.id} citation={law.citation} heading={law.heading} url={url} keepCount={law.keepCount} dissolveCount={law.dissolveCount} size="post" />
            <div className={styles.trialTallyWrap}>
              <div className={styles.trialTally} aria-label={`${keepPct}% keep`}><i style={{ width: `${keepPct}%` }} /></div>
              <p className={styles.trialTallyLabel}><span>▲ {law.keepCount.toLocaleString()} keep</span><b>{total.toLocaleString()} jurors so far</b><span>▼ {law.dissolveCount.toLocaleString()} dissolve</span></p>
            </div>
          </div>
        </div>
      </section>

      {yesterday && <section className={styles.trialYesterday} data-testid="docket-yesterday">
        <b>yesterday’s verdict:</b> <Link href={lawUrl(yesterday)}>{yesterday.citation} — {yesterday.heading}</Link>
        {yesterday.totalCount > 0
          ? <> · the People said <b data-dissolve={yesterday.dissolveRatio >= 0.5}>{yesterday.dissolveRatio >= 0.5 ? `DISSOLVE (${Math.round(yesterday.dissolveRatio * 100)}%)` : `KEEP (${Math.round((1 - yesterday.dissolveRatio) * 100)}%)`}</b> on {yesterday.totalCount.toLocaleString()} ballots</>
          : <> · still open</>}
      </section>}

      <div className={styles.trialComments}>
        <Comments nodeId={law.id} initial={takes} />
      </div>
    </div>
  </div>;
}
