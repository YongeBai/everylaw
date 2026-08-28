"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { titleNumberFromSlug, TOPBAR_TITLES } from "@/lib/title-names";
import { subredditUrl } from "@/lib/reddit-format";
import { ThemeToggle } from "@/components/r/theme-toggle";
import styles from "@/app/r/reddit.module.css";

type Suggestion = { citation: string; heading: string; url: string };

export function RHeader({ activeTitle }: { activeTitle?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setItems([]); return; }
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (response.ok) setItems((await response.json()).results);
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <>
    <div className={styles.topbar}>
      <Link href="/" className={styles.topbarHome}>ALL</Link>
      {TOPBAR_TITLES.map(([num, label]) => <Link key={num} data-active={(activeTitle && titleNumberFromSlug(activeTitle) === num) || undefined} href={subredditUrl(num)}>{label}</Link>)}
      <Link href="/r" className={styles.topbarMore}>browse all titles »</Link>
    </div>
    <header className={styles.header}>
      <Link href="/" className={styles.logo}><span className={styles.logoMark} aria-hidden>§</span>everylaw<i>the front page of the U.S. Code</i></Link>
      <form className={styles.headerSearch} onSubmit={(event) => { event.preventDefault(); if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`); }}>
        <label className="sr-only" htmlFor="r-search">Search laws and sections</label>
        <input id="r-search" data-testid="r-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search laws & sections" autoComplete="off" />
        {items.length > 0 && query.trim().length >= 2 && <div className={styles.searchDrop} data-testid="r-search-suggestions">
          {items.map((item) => <button type="button" key={item.url} onClick={() => router.push(item.url)}><b>{item.citation}</b> — {item.heading}</button>)}
        </div>}
      </form>
      <nav className={styles.headerLinks}>
        <Link href="/docket">today’s trial</Link>
        <Link href="/r/random" data-testid="r-random-link">random law</Link>
        <Link href="/r/history" data-testid="r-history-link">my votes</Link>
        <ThemeToggle />
      </nav>
    </header>
  </>;
}
