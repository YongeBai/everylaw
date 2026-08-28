import type { Metadata } from "next";
import Link from "next/link";
import { getTitles } from "@/lib/data";
import { subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { RHeader } from "@/components/reader/header";
import styles from "../reader.module.css";

export const metadata: Metadata = { title: "all subreddits — every title of the U.S. Code", description: "Every title of the United States Code as a subreddit: browse all sections, read them in plain English, and vote keep or dissolve." };

export default async function AllTitles() {
  const titles = await getTitles();
  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="all-titles">all subreddits — the titles of the U.S. Code</h1>
        <div data-testid="title-list">
          {titles.map((title, index) => <article className={styles.thing} key={title.id}>
            <div className={styles.rowLead}><span className={styles.rank}>{index + 1}</span></div>
            <span className={styles.thumb} aria-hidden>§</span>
            <div className={styles.entry}>
              <p className={styles.postTitle}><Link href={subredditUrl(Number(title.num))}>r/{subredditSlug(Number(title.num))}</Link></p>
              <p className={styles.tagline}>{title.sectionCount.toLocaleString()} sections · moderated by Congress (inactive)</p>
            </div>
          </article>)}
        </div>
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>about this list</h2><div className={styles.sideBoxBody}>
          <p><b>Codified federal statutes, organized the way Congress publishes them.</b> Repealed and reserved sections stay visible because history still gets cited.</p>
          <p><Link href="/">back to the front page →</Link></p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain.</footer>
  </div>;
}
