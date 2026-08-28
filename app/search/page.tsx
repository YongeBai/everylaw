import type { Metadata } from "next";
import Link from "next/link";
import { searchLaws } from "@/lib/data";
import { agePhrase, lawUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { RHeader } from "@/components/r/header";
import { VoteArrows } from "@/components/r/vote-arrows";
import styles from "@/app/r/reddit.module.css";

export const metadata: Metadata = { title: "search — everylaw" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.slice(0, 100) || "";
  const results = query ? await searchLaws(query) : [];

  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="search-title">{query ? <>search results for “{query}”</> : "search"}</h1>
        {!query && <p style={{ padding: "4px", color: "var(--muted)" }}>Type a citation, a phrase, or a headline into the search box above.</p>}
        {query && results.length === 0 && <p style={{ padding: "4px", color: "var(--muted)" }} data-testid="search-empty">No matching section yet. Try a shorter phrase or citation.</p>}
        {results.length > 0 && <div data-testid="search-results">
          {results.map((law, index) => {
            const url = lawUrl(law);
            return <article className={styles.thing} key={law.id} data-testid={`result-${law.id}`}>
              <div className={styles.rowLead}>
                <span className={styles.rank}>{index + 1}</span>
                <VoteArrows nodeId={law.id} citation={law.citation} heading={law.heading} url={url} keepCount={law.keepCount} dissolveCount={law.dissolveCount} />
              </div>
              <span className={styles.thumb} aria-hidden>§</span>
              <div className={styles.entry}>
                <p className={styles.postTitle}>
                  <Link href={url}>{law.citation} — {law.heading}</Link>
                  {law.status !== "active" && <span className={styles.postFlair}>{law.status}</span>}
                </p>
                <p className={styles.tagline}>submitted {agePhrase(law.enactedDate)} by {law.enactingPl ?? "Congress"} to <Link href={subredditUrl(law.title)}>r/{subredditSlug(law.title)}</Link> · {law.keepCount} keep · {law.dissolveCount} dissolve</p>
                <p className={styles.buttons}><Link href={url}>read the law</Link></p>
              </div>
            </article>;
          })}
        </div>}
      </main>
      <aside className={styles.side}>
        <div className={styles.sideBox}><h2>search tips</h2><div className={styles.sideBoxBody}>
          <p>Search matches headings, citations, and the full text of every section in force.</p>
          <p>Try <Link href="/search?q=margarine">margarine</Link>, <Link href="/search?q=flag">flag</Link>, or a citation like <Link href={`/search?q=${encodeURIComponent("18 U.S.C. § 700")}`}>18 U.S.C. § 700</Link>.</p>
        </div></div>
      </aside>
    </div>
    <footer className={styles.footer}>Official text is public domain.</footer>
  </div>;
}
