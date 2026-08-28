import Link from "next/link";
import { type RPost } from "@/lib/reddit-data";
import { agePhrase, lawUrl, officialSourceUrl, subredditUrl } from "@/lib/reddit-format";
import { subredditSlug } from "@/lib/title-names";
import { VoteArrows } from "@/components/reader/vote-arrows";
import { VoteLeanThumb, VoteTotals } from "@/components/reader/vote-totals";
import styles from "@/app/(reader)/reader.module.css";

export function PostList({ posts, startRank = 1 }: { posts: RPost[]; startRank?: number }) {
  if (posts.length === 0) return <p style={{ padding: 12, color: "var(--muted)" }}>Nothing here yet — be the first to judge a section in this title.</p>;
  return <div data-testid="post-list">
    {posts.map((post, index) => {
      const url = lawUrl(post);
      return <article className={styles.thing} key={post.id} data-testid={`post-${post.id}`}>
        <div className={styles.rowLead}>
          <span className={styles.rank}>{startRank + index}</span>
          <VoteArrows nodeId={post.id} citation={post.citation} heading={post.heading} url={url} keepCount={post.keepCount} dissolveCount={post.dissolveCount} />
        </div>
        <VoteLeanThumb nodeId={post.id} keepCount={post.keepCount} dissolveCount={post.dissolveCount}>{post.title}</VoteLeanThumb>
        <div className={styles.entry}>
          <p className={styles.postTitle}>
            <Link href={url}>{post.citation} — {post.heading}</Link>
            <span className={styles.domain}>(<a href={officialSourceUrl(post.title, post.num)} target="_blank" rel="noopener">uscode.house.gov</a>)</span>
            {post.status !== "active" && <span className={styles.postFlair}>{post.status}</span>}
          </p>
          <p className={styles.tagline}>
            submitted {agePhrase(post.enactedDate)} by {post.enactingPl ?? "Congress"} to <Link href={subredditUrl(post.title)}>r/{subredditSlug(post.title)}</Link>
            <VoteTotals nodeId={post.id} keepCount={post.keepCount} dissolveCount={post.dissolveCount} />
            {post.recentVotes > 0 && <> · {post.recentVotes} vote{post.recentVotes === 1 ? "" : "s"} this week</>}
          </p>
          <p className={styles.buttons}><Link href={url}>{post.commentCount} argument{post.commentCount === 1 ? "" : "s"}</Link><span>share</span></p>
        </div>
      </article>;
    })}
  </div>;
}
