import Link from "next/link";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { parseHistory } from "@/lib/history";
import { highlightTerms } from "@/lib/terms";
import { RHeader } from "@/components/reader/header";
import { ShareVerdict } from "@/components/reader/share-verdict";
import { VoteArrows } from "@/components/reader/vote-arrows";
import { DocketVoteTally } from "@/components/reader/vote-totals";
import { OfficialText } from "@/components/reader/official-text";
import { Comments } from "@/components/reader/comments";
import { CitationText } from "@/components/reader/citation-text";
import { linkSectionReferencesInHtml } from "@/lib/citations";
import type { Docket } from "./pick";
import styles from "@/app/(reader)/reader.module.css";

/** Experimental docket design: old-reddit vernacular, distinct from a normal post. */
export function DocketTrial({ docket }: { docket: Docket }) {
  const { law, summary, explanation, origin, takes, locallyDefinedTerms, yesterday, todayKey } = docket;
  const url = lawUrl(law);
  const trialDate = new Date(`${todayKey}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const history = parseHistory(law.sourceCredit);

  return <div className={styles.page}>
    <RHeader />
    <div className={styles.trialStage}>
      <section className={styles.trialBox} data-testid="docket-trial">
        <div className={styles.trialSticky}>⚖ {trialDate} trial<span className={styles.trialStickyRight}>new section is up for trial at midnight Pacific</span></div>
        <div className={styles.trialInner}>
          <p className={styles.tagline}>submitted {agePhrase(law.enactedDate)} by {law.enactingPl ?? "Congress"} to <Link href={subredditUrl(law.title)}>r/{subredditSlug(law.title)}</Link></p>
          <h1 className={styles.trialTitle}><Link href={url}>{law.citation} — {law.heading}</Link></h1>
          {summary
            ? <p className={styles.trialSummary}><CitationText title={law.title}>{summary}</CitationText></p>
            : <p className={styles.trialSummary}>{law.bodyText.slice(0, 420)}{law.bodyText.length > 420 ? "…" : ""}</p>}
          <details className={styles.trialMore}>
            <summary data-testid="trial-show-more">show more</summary>
            {explanation && <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>in plain english</div>
              <div className={styles.sectionBody}><div className={styles.translationBody}><CitationText title={law.title}>{explanation}</CitationText></div></div>
            </div>}
            <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>the actual law <a href={officialSourceUrl(law.title, law.num)} target="_blank" rel="noopener">source ↗</a></div>
              <div className={styles.sectionBody}><OfficialText html={highlightTerms(linkSectionReferencesInHtml(law.bodyHtml, law.title), { title: law.title, section: law.num, excludeTerms: locallyDefinedTerms })} title={law.title} /></div>
            </div>
            {(history.length > 0 || origin) && <div className={styles.section} style={{ marginTop: 10 }}>
              <div className={styles.sectionHead}>history</div>
              <div className={styles.sectionBody}>
                {history.length > 0 && <ul className={styles.historyList}>{history.map((entry, index) => <li key={index}><b>{entry.year ?? "—"}</b><span>{entry.kind === "enacted" ? "Enacted" : "Amended"} · {entry.act}</span></li>)}</ul>}
                {origin && <div className={styles.translationBody} style={{ marginTop: history.length ? 10 : 0 }}><CitationText title={law.title}>{origin}</CitationText></div>}
              </div>
            </div>}
          </details>
          <p className={styles.buttons} style={{ marginTop: 8 }}>
            <Link href={url}>view section</Link>
          </p>
          <div className={styles.trialVerdict}>
            <VoteArrows nodeId={law.id} citation={law.citation} heading={law.heading} url={url} keepCount={law.keepCount} dissolveCount={law.dissolveCount} size="post" />
            <DocketVoteTally nodeId={law.id} keepCount={law.keepCount} dissolveCount={law.dissolveCount} />
            <ShareVerdict nodeId={law.id} citation={law.citation} heading={law.heading} keepCount={law.keepCount} dissolveCount={law.dissolveCount} trialDate={trialDate} />
          </div>
          <p className={styles.trialWatermark} aria-hidden>everylaw.us — the front page of the U.S. Code</p>
        </div>
      </section>

      {yesterday && <section className={styles.trialYesterday} data-testid="docket-yesterday">
        <b>yesterday’s verdict is in:</b> <Link href={lawUrl(yesterday.law)}>{yesterday.law.citation} — {yesterday.law.heading}</Link>
        {yesterday.keepCount + yesterday.dissolveCount > 0
          ? <> · the jury said <b data-dissolve={yesterday.dissolveCount > yesterday.keepCount}>{yesterday.dissolveCount > yesterday.keepCount ? `DISSOLVE (${Math.round((yesterday.dissolveCount / (yesterday.keepCount + yesterday.dissolveCount)) * 100)}%)` : `KEEP (${Math.round((yesterday.keepCount / (yesterday.keepCount + yesterday.dissolveCount)) * 100)}%)`}</b> on {(yesterday.keepCount + yesterday.dissolveCount).toLocaleString()} ballots — final</>
          : <> · mistrial: no jurors voted</>}
      </section>}

      <div className={styles.trialComments}>
        <Comments nodeId={law.id} initial={takes} title={law.title} />
      </div>
    </div>
  </div>;
}
