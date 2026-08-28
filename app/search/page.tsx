import type { Metadata } from "next";
import Link from "next/link";
import { searchRPosts } from "@/lib/reddit-data";
import { RHeader } from "@/components/reader/header";
import { PostList } from "@/components/reader/post-list";
import styles from "@/app/(reader)/reader.module.css";

export const metadata: Metadata = { title: "search — everylaw" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.slice(0, 100) || "";
  const results = query ? await searchRPosts(query) : [];

  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle} data-testid="search-title">{query ? <>search results for “{query}”</> : "search"}</h1>
        {!query && <p style={{ padding: "4px", color: "var(--muted)" }}>Type a citation, a phrase, or a headline into the search box above.</p>}
        {query && results.length === 0 && <p style={{ padding: "4px", color: "var(--muted)" }} data-testid="search-empty">No matching section. Try a shorter phrase or citation.</p>}
        {results.length > 0 && <div data-testid="search-results">
          <PostList posts={results} />
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
