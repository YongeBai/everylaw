import Link from "next/link";
import { type RPost } from "@/lib/reddit-data";
import { agePhrase, lawUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { VoteArrows } from "@/components/r/vote-arrows";
import styles from "@/app/r/reddit.module.css";

export function PostList({ posts, startRank = 1 }: { posts: RPost[]; startRank?: number }) {
  if (posts.length === 0) return <p style={{ padding: 12, color: "var(--muted)" }}>Nothing here yet — be the first to judge a law in this title.</p>;
  return <div data-testid="post-list">
    {posts.map((post, index) => {
      const url = lawUrl(post);
      return <article className={styles.thing} key={post.id} data-testid={`post-${post.id}`}>
        <div className={styles.rowLead}>
          <span className={styles.rank}>{startRank + index}</span>
          <VoteArrows nodeId={post.id} citation={post.citation} heading={post.heading} url={url} keepCount={post.keepCount} dissolveCount={post.dissolveCount} />
        </div>
        <span className={styles.thumb} aria-hidden>§</span>
        <div className={styles.entry}>
          <p className={styles.postTitle}>
            <Link href={url}>{post.citation} — {post.heading}</Link>
            {post.status !== "active" && <span className={styles.postFlair}>{post.status}</span>}
            {post.recentVotes > 0 && <span className={styles.postFlair}>{post.recentVotes} vote{post.recentVotes === 1 ? "" : "s"} this week</span>}
          </p>
          <p className={styles.tagline}>submitted {agePhrase(post.enactedDate)} by {post.enactingPl ?? "Congress"} to <Link href={subredditUrl(post.title)}>r/{subredditSlug(post.title)}</Link> · {post.keepCount} keep · {post.dissolveCount} dissolve</p>
          <p className={styles.buttons}><Link href={url}>{post.commentCount} case{post.commentCount === 1 ? "" : "s"}</Link><Link href={url}>read the law</Link><span>share</span></p>
        </div>
      </article>;
    })}
  </div>;
}
