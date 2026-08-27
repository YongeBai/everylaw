"use client";

import { useMemo, useState } from "react";
import styles from "@/app/r/reddit.module.css";

export type RComment = { id: number; stance: "keep" | "dissolve"; body: string; upvoteCount: number; downvoteCount: number; parentId: number | null; createdAt: string };

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function CommentForm({ nodeId, parentId, onPosted, onCancel }: { nodeId: number; parentId: number | null; onPosted: (comment: RComment) => void; onCancel?: () => void }) {
  const [stance, setStance] = useState<"keep" | "dissolve">("keep");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/takes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, stance, body, website: "", parentId: parentId ?? undefined }) });
    const result = await response.json();
    if (response.ok) { onPosted(result.take as RComment); setBody(""); setMessage(""); onCancel?.(); }
    else setMessage(result.error || "Could not post");
  }

  return <form className={styles.commentForm} onSubmit={submit} data-testid={parentId ? `reply-form-${parentId}` : "comment-form"}>
    <div className={styles.stancePick}>
      <button type="button" data-stance="keep" aria-pressed={stance === "keep"} onClick={() => setStance("keep")}>keep because…</button>
      <button type="button" data-stance="dissolve" aria-pressed={stance === "dissolve"} onClick={() => setStance("dissolve")}>dissolve because…</button>
    </div>
    <textarea data-testid={parentId ? `reply-body-${parentId}` : "comment-body"} required minLength={3} maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} placeholder="one claim, 280 characters — markdown-style *emphasis* welcome" />
    <div className={styles.formRow}>
      <span>{body.length}/280</span>
      {onCancel && <button type="button" className={styles.linkButton} onClick={onCancel}>cancel</button>}
      <button data-testid={parentId ? `reply-save-${parentId}` : "comment-save"} className={styles.saveButton}>save</button>
    </div>
    {message && <p role="alert" className={styles.formError}>{message}</p>}
  </form>;
}

function CommentNode({ comment, childrenOf, nodeId, onPosted, onVoted, depth }: {
  comment: RComment; childrenOf: Map<number | null, RComment[]>; nodeId: number;
  onPosted: (comment: RComment) => void; onVoted: (id: number, up: number, down: number) => void; depth: number;
}) {
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const kids = childrenOf.get(comment.id) ?? [];
  const score = comment.upvoteCount - comment.downvoteCount;

  async function voteComment(direction: 1 | -1) {
    const response = await fetch("/api/take-vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ takeId: comment.id, direction }) });
    const result = await response.json();
    if (response.ok) onVoted(comment.id, result.upvoteCount, result.downvoteCount);
  }

  return <div className={styles.comment} data-testid={`comment-${comment.id}`} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
    <div className={styles.commentArrows}>
      <button aria-label="upvote comment" data-testid={`cup-${comment.id}`} onClick={() => voteComment(1)}>▲</button>
      <button aria-label="downvote comment" data-testid={`cdown-${comment.id}`} onClick={() => voteComment(-1)}>▼</button>
    </div>
    <div className={styles.commentMain}>
      <p className={styles.commentMeta}>
        <button className={styles.collapse} onClick={() => setCollapsed((now) => !now)}>[{collapsed ? "+" : "–"}]</button>
        <span data-stance={comment.stance} className={styles.stanceTag}>{comment.stance.toUpperCase()}</span>
        <b data-testid={`cscore-${comment.id}`}>{score} point{Math.abs(score) === 1 ? "" : "s"}</b>
        <span>({comment.upvoteCount}|{comment.downvoteCount})</span>
        <span>{ago(comment.createdAt)}</span>
      </p>
      {!collapsed && <>
        <p className={styles.commentBody}>{comment.body}</p>
        <p className={styles.commentActions}>
          <button className={styles.linkButton} data-testid={`creply-${comment.id}`} onClick={() => setReplying((now) => !now)}>reply</button>
          <span className={styles.linkQuiet}>permalink</span>
        </p>
        {replying && <CommentForm nodeId={nodeId} parentId={comment.id} onPosted={onPosted} onCancel={() => setReplying(false)} />}
        {kids.map((kid) => <CommentNode key={kid.id} comment={kid} childrenOf={childrenOf} nodeId={nodeId} onPosted={onPosted} onVoted={onVoted} depth={depth + 1} />)}
      </>}
    </div>
  </div>;
}

export function Comments({ nodeId, initial }: { nodeId: number; initial: RComment[] }) {
  const [comments, setComments] = useState<RComment[]>(initial);

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, RComment[]>();
    const sorted = [...comments].sort((a, b) => (b.upvoteCount - b.downvoteCount) - (a.upvoteCount - a.downvoteCount) || b.id - a.id);
    for (const comment of sorted) {
      const key = comment.parentId ?? null;
      map.set(key, [...(map.get(key) ?? []), comment]);
    }
    return map;
  }, [comments]);

  const onPosted = (comment: RComment) => setComments((now) => [...now, comment]);
  const onVoted = (id: number, up: number, down: number) => setComments((now) => now.map((comment) => comment.id === id ? { ...comment, upvoteCount: up, downvoteCount: down } : comment));
  const roots = childrenOf.get(null) ?? [];

  return <section className={styles.comments} data-testid="comments">
    <p className={styles.commentsHead}>all {comments.length} case{comments.length === 1 ? "" : "s"} · sorted by: <b>best</b></p>
    <CommentForm nodeId={nodeId} parentId={null} onPosted={onPosted} />
    {roots.map((comment) => <CommentNode key={comment.id} comment={comment} childrenOf={childrenOf} nodeId={nodeId} onPosted={onPosted} onVoted={onVoted} depth={0} />)}
    {roots.length === 0 && <p className={styles.commentsEmpty}>no cases yet — make the first one</p>}
  </section>;
}
