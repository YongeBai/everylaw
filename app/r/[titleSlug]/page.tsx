import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTitleInfo } from "@/lib/data";
import { subredditSlug, titleNumberFromSlug } from "@/lib/title-names";
import { RHeader } from "@/components/r/header";
import { PostList } from "@/components/r/post-list";
import { getRPosts, isSort, R_SORTS, type RSort } from "@/lib/reddit-data";
import styles from "../reddit.module.css";

type Props = { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ sort?: string; page?: string }> };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug } = await params;
  const titleNum = titleNumberFromSlug(titleSlug);
  const slug = titleNum ? subredditSlug(titleNum) : titleSlug;
  return { title: `r/${slug}`, description: `Every section of ${slug.replaceAll("-", " ")}, readable and judged in public.` };
}

export default async function Subreddit({ params, searchParams }: Props) {
  const { titleSlug } = await params;
  const { sort: raw, page: rawPage } = await searchParams;
  const titleNum = titleNumberFromSlug(titleSlug);
  if (!titleNum) notFound();
  const sort: RSort = raw && isSort(raw) ? raw : "hot";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  // The named slug is canonical; bare r/title-18 (and stale names) land here too.
  const canonical = subredditSlug(titleNum);
  const pageUrl = (target: number) => `/r/${canonical}?${new URLSearchParams({ ...(sort !== "hot" ? { sort } : {}), ...(target > 1 ? { page: String(target) } : {}) })}`.replace(/\?$/, "");
  if (titleSlug !== canonical) redirect(pageUrl(page));
  const [posts, info] = await Promise.all([getRPosts(sort, titleNum, PAGE_SIZE, (page - 1) * PAGE_SIZE), getTitleInfo(titleNum)]);
  if (!info) notFound();
  const pageCount = Math.max(1, Math.ceil(info.sectionCount / PAGE_SIZE));

  return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    <nav className={styles.tabs} aria-label="Sort">
      {R_SORTS.map((item) => <Link key={item.key} data-active={item.key === sort || undefined} href={item.key === "hot" ? `/r/${canonical}` : `/r/${canonical}?sort=${item.key}`}>{item.label}</Link>)}
    </nav>
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="subreddit-title">r/{canonical} — {info.heading}</h1>
        <PostList posts={posts} startRank={(page - 1) * PAGE_SIZE + 1} />
        <nav className={styles.tagline} style={{ padding: "8px 4px" }} aria-label="Pages" data-testid="subreddit-pages">view more:{" "}
          {page > 1 ? <Link href={pageUrl(page - 1)} rel="prev">‹ prev</Link> : <span>‹ prev</span>}
          {" | "}
          {page < pageCount ? <Link href={pageUrl(page + 1)} rel="next">next ›</Link> : <span>next ›</span>}
          <span style={{ marginLeft: 8 }}>page {page} of {pageCount}</span>
        </nav>
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>about r/{canonical}</h2><div className={styles.sideBoxBody}>
          <p><b>Title {titleNum} — {info.heading}.</b> Every section of this title is a post: read it, read its translation and history, then vote keep or dissolve.</p>
          <div className={styles.sideStat}><span>sections</span><b>{info.sectionCount.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>moderator</span><b>Congress (inactive)</b></div>
          <p style={{ marginTop: 8 }}><Link href={`/r/${canonical}/wiki`}>wiki: defined terms in this title</Link></p>
          <p><a href={`https://uscode.house.gov/browse/prelim@title${titleNum}`} target="_blank" rel="noopener">official record at uscode.house.gov ↗</a></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain.</footer>
  </div>;
}
