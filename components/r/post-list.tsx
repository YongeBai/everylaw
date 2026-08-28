import Link from "next/link";
import { type RPost } from "@/lib/reddit-data";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { VoteArrows } from "@/components/r/vote-arrows";
import styles from "@/app/r/reddit.module.css";

// Golden-angle spread keeps neighboring titles' book-spine tints distinct.
const thumbHue = (title: number) => Math.round(title * 137.5) % 360;

export function PostList({ posts, startRank = 1 }: { posts: RPost[]; startRank?: number }) {
  if (posts.length === 0) return <p style={{ padding: 12, color: "var(--muted)" }}>Nothing here yet — be the first to judge a law in this title.</p>;
  return <div data-testid="post-list">
    {posts.map((post, index) => {
      const url = lawUrl(post);
      const voteTotal = post.keepCount + post.dissolveCount;
      return <article className={styles.thing} key={post.id} data-testid={`post-${post.id}`}>
        <div className={styles.rowLead}>
          <span className={styles.rank}>{startRank + index}</span>
          <VoteArrows nodeId={post.id} citation={post.citation} heading={post.heading} url={url} keepCount={post.keepCount} dissolveCount={post.dissolveCount} />
        </div>
        <span className={styles.thumb} style={{ "--thumb-hue": thumbHue(post.title) } as React.CSSProperties} aria-hidden>{post.title}</span>
        <div className={styles.entry}>
          <p className={styles.postTitle}>
            <Link href={url}>{post.citation} — {post.heading}</Link>
            <span className={styles.domain}>(<a href={officialSourceUrl(post.title, post.num)} target="_blank" rel="noopener">uscode.house.gov</a>)</span>
            {post.status !== "active" && <span className={styles.postFlair}>{post.status}</span>}
          </p>
          <p className={styles.tagline}>
            submitted {agePhrase(post.enactedDate)} by {post.enactingPl ?? "Congress"} to <Link href={subredditUrl(post.title)}>r/{subredditSlug(post.title)}</Link>
            {voteTotal > 0 && <> · <span className={styles.keepInk}>{post.keepCount} keep</span> · <span className={styles.dissolveInk}>{post.dissolveCount} dissolve</span></>}
            {post.recentVotes > 0 && <> · {post.recentVotes} vote{post.recentVotes === 1 ? "" : "s"} this week</>}
          </p>
          <p className={styles.buttons}><Link href={url}>{post.commentCount} case{post.commentCount === 1 ? "" : "s"}</Link><Link href={url}>read the law</Link><span>share</span></p>
        </div>
      </article>;
    })}
  </div>;
}
