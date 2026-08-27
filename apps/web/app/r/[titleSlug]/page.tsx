import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTitles } from "@/lib/data";
import { RHeader } from "@/components/r/header";
import { PostList } from "@/components/r/post-list";
import { getRPosts, R_SORTS, type RSort } from "@/lib/reddit-data";
import styles from "../reddit.module.css";

type Props = { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ sort?: string }> };
export const dynamic = "force-dynamic";

const isSort = (value: string): value is RSort => R_SORTS.some((sort) => sort.key === value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug } = await params;
  return { title: `r/${titleSlug}`, description: `Every section of ${titleSlug.replace("-", " ")}, readable and judged in public.` };
}

export default async function Subreddit({ params, searchParams }: Props) {
  const { titleSlug } = await params;
  const { sort: raw } = await searchParams;
  const titleNum = Number(titleSlug.match(/^title-(\d+)$/)?.[1]);
  if (!titleNum) notFound();
  const sort: RSort = raw && isSort(raw) ? raw : "hot";
  const [posts, titles] = await Promise.all([getRPosts(sort, titleNum), getTitles()]);
  const info = titles.find((title) => Number(title.num) === titleNum);
  if (!info) notFound();

  return <div className={styles.page}>
    <RHeader activeTitle={titleSlug} />
    <nav className={styles.tabs} aria-label="Sort">
      {R_SORTS.map((item) => <Link key={item.key} data-active={item.key === sort || undefined} href={item.key === "hot" ? `/r/${titleSlug}` : `/r/${titleSlug}?sort=${item.key}`}>{item.label}</Link>)}
    </nav>
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 style={{ font: "700 16px Verdana, sans-serif", margin: "4px 4px 8px" }} data-testid="subreddit-title">r/{titleSlug} — {info.heading}</h1>
        <PostList posts={posts} />
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>about r/{titleSlug}</h2><div className={styles.sideBoxBody}>
          <p><b>Title {titleNum} — {info.heading}.</b> Every section of this title is a post: read it, read its translation and history, then vote keep or dissolve.</p>
          <div className={styles.sideStat}><span>sections</span><b>{info.sectionCount.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>moderator</span><b>Congress (inactive)</b></div>
          <p style={{ marginTop: 8 }}><Link href={`/us/title-${titleNum}`}>browse the citable record →</Link></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain.</footer>
  </div>;
}
