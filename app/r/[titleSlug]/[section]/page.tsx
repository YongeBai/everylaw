import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAiContent, getDefinedTermsInScope, getLaw, getLawNavigation, getTakes } from "@/lib/data";
import { viewerVoterHash } from "@/lib/viewer";
import { parseHistory } from "@/lib/history";
import { highlightTerms, markDefinedTerms } from "@/lib/terms";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl, wikiUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { RHeader } from "@/components/r/header";
import { VoteArrows } from "@/components/r/vote-arrows";
import { OfficialText } from "@/components/r/official-text";
import { Comments } from "@/components/r/comments";
import styles from "../../reddit.module.css";

type Props = { params: Promise<{ titleSlug: string; section: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug, section } = await params;
  const law = await getLaw(titleSlug, decodeURIComponent(section));
  if (!law) return { title: "Law not found" };
  return { title: `${law.citation} — ${law.heading}`, description: `Read ${law.citation} in plain English, see its history, and make the case to keep or dissolve it.`, alternates: { canonical: lawUrl(law) } };
}

export default async function RPostPage({ params }: Props) {
  const { titleSlug, section } = await params;
  const law = await getLaw(titleSlug, decodeURIComponent(section));
  if (!law) notFound();
  const [content, takes, navigation, definedTerms] = await Promise.all([getAiContent(law.id), viewerVoterHash().then((hash) => getTakes(law.id, hash)), getLawNavigation(law), getDefinedTermsInScope(law)]);
  const history = parseHistory(law.sourceCredit);
  const url = lawUrl(law);
  const sourceUrl = officialSourceUrl(law.title, law.num);
  const titleWikiUrl = wikiUrl(law.title);
  const officialHtml = highlightTerms(markDefinedTerms(law.bodyHtml, definedTerms));
  // The card only needs the terms that actually got starred in this body.
  const starredTerms = definedTerms
    .filter((term) => officialHtml.includes(`data-def="${term.id}"`))
    .map((term) => ({ id: term.id, term: term.term, definition: term.definition, scopeType: term.scopeType, citation: term.citation, heading: term.heading, url: lawUrl(term) }));

  return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    <div className={styles.shell}>
      <main className={styles.main}>
        <article className={styles.post}>
          <VoteArrows nodeId={law.id} citation={law.citation} heading={law.heading} url={url} keepCount={law.keepCount} dissolveCount={law.dissolveCount} size="post" />
          <div className={styles.postHead}>
            <h1><Link href={sourceUrl} target="_blank" rel="noopener">{law.citation} — {law.heading}</Link>{law.status !== "active" && <span className={styles.postFlair}>{law.status}</span>}</h1>
            <p className={styles.tagline}>submitted {agePhrase(law.enactedDate)} by {law.enactingPl ?? "Congress"} to <Link href={subredditUrl(law.title)}>r/{subredditSlug(law.title)}</Link> · {law.wordCount.toLocaleString()} words · {law.keepCount} keep · {law.dissolveCount} dissolve</p>

            <section className={styles.section} data-testid="post-translation">
              <div className={styles.sectionHead}>in plain english<span className={styles.aiBadge}>AI-assisted · reviewed · not legal advice</span></div>
              <div className={styles.sectionBody}>
                {content.summary && <p className={styles.translationBody} style={{ fontWeight: 700, marginTop: 0 }}>{content.summary.body}</p>}
                {content.explanation
                  ? <div className={styles.translationBody} style={{ marginTop: content.summary ? 10 : 0 }}>{content.explanation.body}</div>
                  : <p className={styles.pendingNote}>A reviewed translation hasn’t been published for this section yet. The official text below is complete and authoritative.</p>}
                {content.facts && <div style={{ marginTop: 12, borderTop: "1px dotted var(--border-mid)", paddingTop: 10 }}>
                  <p style={{ margin: "0 0 4px", font: "700 10px Verdana, sans-serif", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>facts</p>
                  <div className={styles.translationBody} data-testid="post-facts">{content.facts.body}</div>
                </div>}
              </div>
            </section>

            <section className={styles.section} data-testid="post-official">
              <div className={styles.sectionHead}>the actual law <a href={sourceUrl} target="_blank" rel="noopener">source: uscode.house.gov ↗</a><span className={styles.aiBadge}>public domain</span></div>
              <div className={styles.sectionBody}><OfficialText html={officialHtml} statutoryTerms={starredTerms} wikiUrl={titleWikiUrl} />
                {law.sourceCredit && <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>Source credit: {law.sourceCredit}</p>}</div>
            </section>

            <section className={styles.section} data-testid="post-history">
              <div className={styles.sectionHead}>history &amp; why it exists<span className={styles.aiBadge}>record from the source credit</span></div>
              <div className={styles.sectionBody}>
                {history.length > 0 && <ul className={styles.historyList}>{history.map((entry, index) => <li key={index}><b>{entry.year ?? "—"}</b><span>{entry.kind === "enacted" ? "Enacted" : "Amended"} · {entry.act}{entry.statAtLarge ? ` · ${entry.statAtLarge}` : ""}</span></li>)}</ul>}
                {content.origin
                  ? <div className={styles.translationBody} style={{ marginTop: history.length ? 10 : 0 }}>{content.origin.body}</div>
                  : <p className={styles.pendingNote} style={{ marginTop: history.length ? 10 : 0 }}>A reviewed history note hasn’t been published yet.{law.enactingPl ? ` The record shows enactment by ${law.enactingPl}${law.enactedDate ? ` on ${law.enactedDate}` : ""}.` : ""}</p>}
              </div>
            </section>

            <Comments nodeId={law.id} initial={takes} />
          </div>
        </article>
      </main>
      <aside className={styles.side} data-testid="related-laws">
        <div className={styles.sideBox}><h2>at a glance</h2><div className={styles.sideBoxBody}>
          <div className={styles.sideStat}><span>enacted</span><b>{law.enactedDate ?? "unrecorded"}</b></div>
          <div className={styles.sideStat}><span>by</span><b>{law.enactingPl ?? "unrecorded"}</b></div>
          <div className={styles.sideStat}><span>amendments on record</span><b>{Math.max(0, history.length - 1)}</b></div>
          <div className={styles.sideStat}><span>words</span><b>{law.wordCount.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>status</span><b>{law.status}</b></div>
        </div></div>
        <div className={styles.sideBox}><h2>related laws</h2><div className={styles.sideBoxBody}>
          <ul className={styles.related}>
            {navigation.previous && <li><Link href={lawUrl(navigation.previous)}>{navigation.previous.citation} — {navigation.previous.heading}</Link></li>}
            {navigation.next && <li><Link href={lawUrl(navigation.next)}>{navigation.next.citation} — {navigation.next.heading}</Link></li>}
            {navigation.related.map((item) => <li key={item.id}><Link href={lawUrl(item)}>{item.citation} — {item.heading}</Link></li>)}
            <li><Link href={titleWikiUrl}>wiki: defined terms in this title</Link></li>
          </ul>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain. AI translations are reviewed and are not legal advice.</footer>
  </div>;
}
