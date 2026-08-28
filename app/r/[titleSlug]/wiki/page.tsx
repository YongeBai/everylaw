import type { Metadata } from "next";
import Link from "next/link";
import { CitationText } from "@/components/r/citation-text";
import { notFound, redirect } from "next/navigation";
import { getTitleInfo, getTitleWikiTerms } from "@/lib/data";
import { lawUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug, titleNumberFromSlug } from "@/lib/title-names";
import { RHeader } from "@/components/r/header";
import styles from "../../reddit.module.css";

type Props = { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ page?: string }> };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 150;

const SCOPE_LABELS: Record<string, string> = {
  title: "applies throughout this title",
  part: "applies throughout its part",
  chapter: "applies throughout its chapter",
  subchapter: "applies throughout its subchapter",
  subpart: "applies throughout its subpart",
  division: "applies throughout its division",
  section: "applies in that section",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug } = await params;
  const titleNum = titleNumberFromSlug(titleSlug);
  const slug = titleNum ? subredditSlug(titleNum) : titleSlug;
  return { title: `r/${slug} wiki — defined terms`, description: `Every term this title defines, where it defines it, and how far each definition reaches.` };
}

export default async function TitleWiki({ params, searchParams }: Props) {
  const { titleSlug } = await params;
  const { page: rawPage } = await searchParams;
  const titleNum = titleNumberFromSlug(titleSlug);
  if (!titleNum) notFound();
  const requestedPage = Number(rawPage || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const canonical = subredditSlug(titleNum);
  const pageUrl = (target: number) => `/r/${canonical}/wiki${target > 1 ? `?page=${target}` : ""}`;
  if (titleSlug !== canonical) redirect(pageUrl(page));
  const [info, wiki] = await Promise.all([getTitleInfo(titleNum), getTitleWikiTerms(titleNum, PAGE_SIZE, (page - 1) * PAGE_SIZE)]);
  if (!info) notFound();
  const pageCount = Math.max(1, Math.ceil(wiki.termCount / PAGE_SIZE));

  return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="wiki-title">r/{canonical} wiki — defined terms</h1>
        <p className={styles.tagline} style={{ padding: "0 4px" }}>The statute&rsquo;s own glossary: every term Title {titleNum} defines, in section order. The index is generated from the official text — each entry links to the defining section, which remains the authority.</p>
        {wiki.termCount === 0 && <p className={styles.commentsEmpty} style={{ padding: "8px 4px" }}>This title defines no terms of its own. Its sections rely on ordinary meaning and definitions borrowed from elsewhere.</p>}
        {wiki.sections.map((section) => <section key={section.identifier} className={styles.section} data-testid="wiki-section">
          <div className={styles.sectionHead}><Link href={lawUrl(section)}>{section.citation}{section.heading ? ` — ${section.heading}` : ""}</Link></div>
          <div className={styles.sectionBody}>
            {section.terms.map((entry) => <div key={entry.id} id={`term-${entry.id}`} style={{ marginBottom: 10 }}>
              <p style={{ margin: 0 }}><b>“{entry.term}”</b> <span style={{ color: "var(--muted)", fontSize: 10, fontStyle: "italic" }}>{SCOPE_LABELS[entry.scopeType] ?? ""}</span></p>
              <p className={styles.translationBody} style={{ margin: "2px 0 0" }}><CitationText title={titleNum}>{entry.definition}</CitationText></p>
            </div>)}
          </div>
        </section>)}
        {pageCount > 1 && <nav className={styles.tagline} style={{ padding: "8px 4px" }} aria-label="Pages" data-testid="wiki-pages">view more:{" "}
          {page > 1 ? <Link href={pageUrl(page - 1)} rel="prev">‹ prev</Link> : <span>‹ prev</span>}
          {" | "}
          {page < pageCount ? <Link href={pageUrl(page + 1)} rel="next">next ›</Link> : <span>next ›</span>}
          <span style={{ marginLeft: 8 }}>page {page} of {pageCount}</span>
        </nav>}
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>about this wiki</h2><div className={styles.sideBoxBody}>
          <p><b>Title {titleNum} — {info.heading}.</b> When a section says a word, these entries say what the word means there. Definitions are part of the law like every other section — this page just gathers them.</p>
          <div className={styles.sideStat}><span>defined terms</span><b>{wiki.termCount.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>sections in title</span><b>{info.sectionCount.toLocaleString()}</b></div>
          <p style={{ marginTop: 8 }}><Link href={subredditUrl(titleNum)}>← back to r/{canonical}</Link></p>
          <p><a href={`https://uscode.house.gov/browse/prelim@title${titleNum}`} target="_blank" rel="noopener">official record at uscode.house.gov ↗</a></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain. Definitions shown here are excerpts — the defining section is the authority.</footer>
  </div>;
}
