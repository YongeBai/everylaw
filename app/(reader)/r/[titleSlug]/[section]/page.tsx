import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getAiContent, getDefinedTermsInScope, getLaw, getLawNavigation, getTakes, getTermsDefinedByLaw } from "@/lib/data";
import { viewerVoterHash } from "@/lib/viewer";
import { getLatestTrial } from "@/lib/trials";
import { TrialFlair } from "@/components/reader/trial-flair";
import { parseHistory } from "@/lib/history";
import { highlightTerms, markDefinedTerms } from "@/lib/terms";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl, wikiUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { RHeader } from "@/components/reader/header";
import { VoteArrows } from "@/components/reader/vote-arrows";
import { VoteTotals } from "@/components/reader/vote-totals";
import { OfficialText } from "@/components/reader/official-text";
import { Comments } from "@/components/reader/comments";
import { CitationText } from "@/components/reader/citation-text";
import { MarkdownBody } from "@/components/reader/markdown-body";
import { linkSectionReferencesInHtml } from "@/lib/citations";
import styles from "../../../reader.module.css";

type Props = { params: Promise<{ titleSlug: string; section: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug, section } = await params;
  const law = await getLaw(titleSlug, decodeURIComponent(section));
  if (!law) return { title: "Section not found" };
  return { title: `${law.citation} — ${law.heading}`, description: `Read ${law.citation} in plain English, see its history, and make the case to keep or dissolve it.`, alternates: { canonical: lawUrl(law) } };
}

export default async function RPostPage({ params }: Props) {
  const { titleSlug, section } = await params;
  const law = await getLaw(titleSlug, decodeURIComponent(section));
  if (!law) notFound();
  const url = lawUrl(law);
  const requestedUrl = `/r/${titleSlug}/${encodeURIComponent(decodeURIComponent(section))}`;
  if (requestedUrl !== url) permanentRedirect(url);
  const [content, takes, navigation, definedTerms, locallyDefinedTerms, trial] = await Promise.all([getAiContent(law.id), viewerVoterHash().then((hash) => getTakes(law.id, hash)), getLawNavigation(law), getDefinedTermsInScope(law), getTermsDefinedByLaw(law.id), getLatestTrial(law.id)]);
  const history = parseHistory(law.sourceCredit);
  const sourceUrl = officialSourceUrl(law.title, law.num);
  const titleWikiUrl = wikiUrl(law.title);
  const officialHtml = highlightTerms(
    markDefinedTerms(linkSectionReferencesInHtml(law.bodyHtml, law.title), definedTerms),
    { title: law.title, section: law.num, excludeTerms: [...locallyDefinedTerms, ...definedTerms.map((term) => term.term)] },
  );
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
            <h1><Link href={sourceUrl} target="_blank" rel="noopener">{law.citation} — {law.heading}</Link>{law.status !== "active" && <span className={styles.postFlair}>{law.status}</span>}<TrialFlair trial={trial} /></h1>
            <p className={styles.tagline}>submitted {agePhrase(law.enactedDate)} by {law.enactingPl ?? "Congress"} to <Link href={subredditUrl(law.title)}>r/{subredditSlug(law.title)}</Link> · {law.wordCount.toLocaleString()} words<VoteTotals nodeId={law.id} keepCount={law.keepCount} dissolveCount={law.dissolveCount} always /></p>

            <section className={styles.section} data-testid="post-translation">
              <div className={styles.sectionHead}>in plain english<span className={styles.aiBadge}>AI-generated · not legal advice</span></div>
              <div className={styles.sectionBody}>
                {content.summary && <p className={styles.translationBody} style={{ fontWeight: 700, marginTop: 0 }}><CitationText title={law.title}>{content.summary.body}</CitationText></p>}
                {content.explanation
                  ? <div className={styles.translationBody} style={{ marginTop: content.summary ? 10 : 0 }}><MarkdownBody source={content.explanation.body} title={law.title} /></div>
                  : <p className={styles.pendingNote}>A translation hasn’t been published for this section yet. The official text below is complete and authoritative.</p>}
                {content.facts && <div style={{ marginTop: 12, borderTop: "1px dotted var(--border-mid)", paddingTop: 10 }}>
                  <p style={{ margin: "0 0 4px", font: "700 10px Verdana, sans-serif", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>facts</p>
                  <div className={styles.translationBody} data-testid="post-facts"><CitationText title={law.title}>{content.facts.body}</CitationText></div>
                </div>}
              </div>
            </section>

            <section className={styles.section} data-testid="post-official">
              <div className={styles.sectionHead}>the actual law <a href={sourceUrl} target="_blank" rel="noopener">source: uscode.house.gov ↗</a><span className={styles.aiBadge}>public domain</span></div>
              <div className={styles.sectionBody}><OfficialText html={officialHtml} statutoryTerms={starredTerms} wikiUrl={titleWikiUrl} title={law.title} />
                {law.sourceCredit && <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>Source credit: <CitationText>{law.sourceCredit}</CitationText></p>}</div>
            </section>

            <section className={styles.section} data-testid="post-history">
              <div className={styles.sectionHead}>history &amp; why it exists<span className={styles.aiBadge}>record from the source credit</span></div>
              <div className={styles.sectionBody}>
                {history.length > 0 && <ul className={styles.historyList}>{history.map((entry, index) => <li key={index}><b>{entry.year ?? "—"}</b><span>{entry.kind === "enacted" ? "Enacted" : "Amended"} · {entry.act}{entry.statAtLarge ? ` · ${entry.statAtLarge}` : ""}</span></li>)}</ul>}
                {content.origin
                  ? <div className={styles.translationBody} style={{ marginTop: history.length ? 10 : 0 }}><CitationText title={law.title}>{content.origin.body}</CitationText></div>
                  : <p className={styles.pendingNote} style={{ marginTop: history.length ? 10 : 0 }}>A history note hasn’t been published yet.{law.enactingPl ? ` The record shows enactment by ${law.enactingPl}${law.enactedDate ? ` on ${law.enactedDate}` : ""}.` : ""}</p>}
              </div>
            </section>

            <Comments nodeId={law.id} initial={takes} title={law.title} />
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
        <div className={styles.sideBox}><h2>related sections</h2><div className={styles.sideBoxBody}>
          <ul className={styles.related}>
            {navigation.previous && <li><Link href={lawUrl(navigation.previous)}>{navigation.previous.citation} — {navigation.previous.heading}</Link></li>}
            {navigation.next && <li><Link href={lawUrl(navigation.next)}>{navigation.next.citation} — {navigation.next.heading}</Link></li>}
            {navigation.related.map((item) => <li key={item.id}><Link href={lawUrl(item)}>{item.citation} — {item.heading}</Link></li>)}
            <li><Link href={titleWikiUrl}>wiki: defined terms in this title</Link></li>
          </ul>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain. Translations are AI-generated and are not legal advice.</footer>
  </div>;
}
