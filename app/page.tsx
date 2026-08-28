import type { Metadata } from "next";
import Link from "next/link";
import { RHeader } from "@/components/r/header";
import { PostList } from "@/components/r/post-list";
import { getCorpusStats } from "@/lib/data";
import { getRPosts, isSort, R_SORTS, type RSort } from "@/lib/reddit-data";
import styles from "@/app/r/reddit.module.css";

export const metadata: Metadata = { title: "EveryLaw — the front page of the U.S. Code", description: "Every federal law, readable and judged in public: plain-English translations, real history, and a keep-or-dissolve signal on each section." };
export const dynamic = "force-dynamic";

export default async function FrontPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: raw } = await searchParams;
  const sort: RSort = raw && isSort(raw) ? raw : "hot";
  const [posts, stats] = await Promise.all([getRPosts(sort), getCorpusStats()]);

  return <div className={styles.page}>
    <RHeader />
    <nav className={styles.tabs} aria-label="Sort">
      {R_SORTS.map((item) => <Link key={item.key} data-active={item.key === sort || undefined} data-testid={`sort-${item.key}`} href={item.key === "hot" ? "/" : `/?sort=${item.key}`}>{item.label}</Link>)}
    </nav>
    <div className={styles.shell}>
      <main className={styles.main}><PostList posts={posts} /></main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>everylaw</h2><div className={styles.sideBoxBody}>
          <p><b>The law never gets a spring cleaning.</b> Read every federal law in plain English, see its real history, and signal keep or dissolve.</p>
          <div className={styles.sideStat}><span>sections in force</span><b>{stats.sectionsInForce.toLocaleString()}</b></div>
          <div className={styles.sideStat}><span>titles</span><b>{stats.titles}</b></div>
          <div className={styles.sideStat}><span>accounts required</span><b>none</b></div>
        </div></div>
        <div className={styles.sideBox}><h2>today’s trial</h2><div className={styles.sideBoxBody}>
          <p>One section stands trial every day. New trial at midnight PST.</p>
          <p><Link href="/docket">Take the stand →</Link></p>
        </div></div>
        <div className={styles.sideBox}><h2>random section</h2><div className={styles.sideBoxBody}>
          <p>An endless stack from all {stats.sectionsInForce.toLocaleString()} sections in force.</p>
          <p><Link href="/r/random">Deal me a section →</Link></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain. AI translations are reviewed and are not legal advice.</footer>
  </div>;
}
