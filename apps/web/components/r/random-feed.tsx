"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoteArrows } from "@/components/r/vote-arrows";
import { agePhrase } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import styles from "@/app/r/reddit.module.css";

type RandomLaw = {
  id: number; citation: string; heading: string; title: number; url: string;
  wordCount: number; enactedDate: string | null; enactingPl: string | null;
  keepCount: number; dissolveCount: number;
  summary: string | null; explanation: string | null; excerpt: string;
};

function QuickTake({ nodeId }: { nodeId: number }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/takes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, body, website: "" }) });
    const result = await response.json();
    if (response.ok) { setBody(""); setMessage("your case is live on the law's page"); }
    else setMessage(result.error || "could not post");
  }

  if (!open) return <p className={styles.buttons} style={{ marginTop: 6 }}><button className={styles.linkButton} data-testid={`quicktake-open-${nodeId}`} onClick={() => setOpen(true)}>give your take</button></p>;
  return <form className={styles.commentForm} onSubmit={submit} style={{ marginBottom: 0 }}>
    <textarea data-testid={`quicktake-body-${nodeId}`} required minLength={3} maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} placeholder="one claim, 280 characters (carries your vote)" />
    <div className={styles.formRow}><span>{body.length}/280</span><button data-testid={`quicktake-save-${nodeId}`} className={styles.saveButton}>save</button></div>
    {message && <p role="status" className={styles.formError} style={{ color: "#c03500" }}>{message}</p>}
  </form>;
}

export function RandomFeed() {
  const [laws, setLaws] = useState<RandomLaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seenRef = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLButtonElement | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true; setLoading(true); setError("");
    try {
      const seen = [...seenRef.current].slice(-250).join(",");
      const response = await fetch(`/api/random?count=5${seen ? `&seen=${seen}` : ""}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "deal failed");
      const fresh = (result.laws as RandomLaw[]).filter((law) => !seenRef.current.has(law.id));
      for (const law of fresh) seenRef.current.add(law.id);
      setLaws((now) => [...now, ...fresh]);
    } catch {
      setError("Could not deal more laws — try again.");
    } finally {
      loadingRef.current = false; setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMore(); }, [loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return <div data-testid="random-feed">
    {laws.map((law) => <article key={law.id} className={styles.section} style={{ marginBottom: 14 }} data-testid={`random-card-${law.id}`}>
      <div className={styles.sectionHead} style={{ textTransform: "none" }}>
        <Link href={law.url}>{law.citation} — {law.heading}</Link>
        <span className={styles.aiBadge}>r/{subredditSlug(law.title)} · {agePhrase(law.enactedDate)} · {law.wordCount.toLocaleString()} words</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", gap: 10, padding: "10px 12px" }}>
        <VoteArrows nodeId={law.id} citation={law.citation} heading={law.heading} url={law.url} keepCount={law.keepCount} dissolveCount={law.dissolveCount} size="post" />
        <div>
          {law.explanation || law.summary
            ? <div className={styles.translationBody}>{law.explanation ?? law.summary}</div>
            : <div className={styles.translationBody}><i style={{ color: "#888" }}>No reviewed translation yet — the law itself:</i> {law.excerpt}{law.excerpt.length >= 400 ? "…" : ""}</div>}
          <p className={styles.buttons} style={{ marginTop: 8 }}>
            <Link href={law.url}>full text &amp; history</Link>
            <Link href={law.url}>cases</Link>
          </p>
          <QuickTake nodeId={law.id} />
        </div>
      </div>
    </article>)}
    {error && <p role="alert" style={{ color: "#b3372b", padding: 8 }}>{error}</p>}
    <button ref={sentinelRef} data-testid="random-more" className={styles.saveButton} style={{ display: "block", margin: "10px auto 30px" }} onClick={() => void loadMore()} disabled={loading}>
      {loading ? "dealing…" : "more random laws"}
    </button>
  </div>;
}
