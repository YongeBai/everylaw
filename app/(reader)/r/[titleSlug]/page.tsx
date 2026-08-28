import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getTitleInfo } from "@/lib/data";
import { subredditPathSlug, subredditSlug, titleNumberFromSlug } from "@/lib/title-names";
import { RHeader } from "@/components/reader/header";
import { PostList } from "@/components/reader/post-list";
import { TitleWiki } from "@/components/reader/title-wiki";
import { getRPosts, isSort, R_SORTS, type RSort } from "@/lib/reddit-data";
import { subredditUrl, wikiUrl } from "@/lib/reddit-format";
import styles from "../../reader.module.css";

type Props = { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ sort?: string; page?: string; view?: string }> };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { titleSlug } = await params;
  const { view } = await searchParams;
  const titleNum = titleNumberFromSlug(titleSlug);
  const slug = titleNum ? subredditSlug(titleNum) : titleSlug;
  if (view === "wiki") return { title: `r/${slug} wiki — defined terms`, description: "Every term this title defines, where it defines it, and how far each definition reaches.", alternates: titleNum ? { canonical: wikiUrl(titleNum) } : undefined };
  return { title: `r/${slug}`, description: `Every section of ${slug.replaceAll("-", " ")}, readable and judged in public.`, alternates: titleNum ? { canonical: subredditUrl(titleNum) } : undefined };
}

export default async function Subreddit({ params, searchParams }: Props) {
  const { titleSlug } = await params;
  const { sort: raw, page: rawPage, view } = await searchParams;
  const titleNum = titleNumberFromSlug(titleSlug);
  if (!titleNum) notFound();
  const sort: RSort = raw && isSort(raw) ? raw : "hot";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const wikiActive = view === "wiki";
  const canonical = subredditPathSlug(titleNum);
  const displaySlug = subredditSlug(titleNum);
  const pageUrl = (target: number) => `/r/${canonical}?${new URLSearchParams({ ...(sort !== "hot" ? { sort } : {}), ...(target > 1 ? { page: String(target) } : {}) })}`.replace(/\?$/, "");
  const wikiPageUrl = (target: number) => `/r/${canonical}?${new URLSearchParams({ view: "wiki", ...(target > 1 ? { page: String(target) } : {}) })}`;
  if (titleSlug !== canonical) permanentRedirect(wikiActive ? wikiPageUrl(page) : pageUrl(page));
  const info = await getTitleInfo(titleNum);
  if (!info) notFound();
  const tabs = <nav className={styles.tabs} aria-label="Title views">
    {R_SORTS.map((item) => <Link key={item.key} data-testid={`sort-${item.key}`} data-active={!wikiActive && item.key === sort || undefined} href={item.key === "hot" ? `/r/${canonical}` : `/r/${canonical}?sort=${item.key}`}>{item.label}</Link>)}
    <Link data-active={wikiActive || undefined} href={wikiPageUrl(1)} data-testid="wiki-tab">wiki</Link>
  </nav>;

  if (wikiActive) return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    {tabs}
    <TitleWiki titleNum={titleNum} canonical={canonical} displaySlug={displaySlug} heading={info.heading} sectionCount={info.sectionCount} page={page} />
    <footer className={styles.footer}>Official text is public domain. Definitions shown here are excerpts — the defining section is the authority.</footer>
  </div>;

  const posts = await getRPosts(sort, titleNum, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(info.sectionCount / PAGE_SIZE));

  return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    {tabs}
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="title-page-heading">r/{displaySlug}</h1>
        <PostList posts={posts} startRank={(page - 1) * PAGE_SIZE + 1} />
        <nav className={styles.tagline} style={{ padding: "8px 4px" }} aria-label="Pages" data-testid="subreddit-pages">view more:{" "}
          {page > 1 ? <Link href={pageUrl(page - 1)} rel="prev">‹ prev</Link> : <span>‹ prev</span>}
          {" | "}
          {page < pageCount ? <Link href={pageUrl(page + 1)} rel="next">next ›</Link> : <span>next ›</span>}
          <span style={{ marginLeft: 8 }}>page {page} of {pageCount}</span>
        </nav>
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>about r/{displaySlug}</h2><div className={styles.sideBoxBody}>
          <p><b>Title {titleNum} — {info.heading}.</b> Every section of this title is a post: read it, read its translation and history, then vote keep or dissolve.</p>
          <div className={styles.sideStat}><span>sections</span><b>{info.sectionCount.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>moderator</span><b>Congress (inactive)</b></div>
          <p><a href={`https://uscode.house.gov/browse/prelim@title${titleNum}`} target="_blank" rel="noopener">official record at uscode.house.gov ↗</a></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain.</footer>
  </div>;
}
