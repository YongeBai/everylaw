"use client";

import { useEffect, useState } from "react";
import { onPostVote, type PostVote } from "@/lib/vote-sync";

type Take = { id: number; body: string; upvoteCount: number; createdAt: string; vote: PostVote | null; mine: boolean };

export function TakesBoard({ nodeId, initialTakes }: { nodeId: number; initialTakes: Take[] }) {
  const [takes, setTakes] = useState(initialTakes);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  // Badges mirror the commenter's vote on the law; keep the viewer's own in sync.
  useEffect(() => onPostVote(({ nodeId: votedNode, vote }) => {
    if (votedNode !== nodeId) return;
    setTakes((current) => current.map((take) => take.mine ? { ...take, vote } : take));
  }), [nodeId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/takes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, body, website: "" }) });
    const result = await response.json();
    if (response.ok) { setTakes((current) => [result.take, ...current]); setBody(""); setMessage("Your case is live."); }
    else setMessage(result.error || "Could not publish");
  }
  async function upvote(id: number) {
    const response = await fetch("/api/take-vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ takeId: id }) });
    const result = await response.json();
    if (response.ok) setTakes((current) => current.map((take) => take.id === id ? { ...take, upvoteCount: result.upvoteCount } : take));
    else setMessage(result.error || "Could not upvote");
  }
  return <section id="takes"><div className="flex items-end justify-between gap-5"><div><p className="eyebrow">Structured public reasoning</p><h2 className="serif text-4xl font-black mt-2">Make the case</h2></div><span className="text-sm text-[#68736d]">No replies. No pile-ons. 280 characters.</span></div>
    <form onSubmit={submit} className="paper-card rounded-2xl p-5 mt-6">
      <label className="sr-only" htmlFor="take-body">Your argument</label><textarea data-testid="take-body" id="take-body" required minLength={3} maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Make your case — your vote above tags it." className="w-full min-h-24 resize-y rounded-xl border border-[#b8aa94] p-4 bg-white outline-none focus:ring-2 focus:ring-[#d9a62e]" />
      <div className="flex justify-between items-center mt-2"><span className="text-xs text-[#68736d]">{body.length}/280</span><button data-testid="submit-take" className="button button-dark">Publish case</button></div>
      {message && <p role="status" className="mt-3 text-sm font-bold">{message}</p>}
    </form>
    <div className="space-y-3 mt-8">
      {takes.map((take) => <article data-testid="take" key={take.id} className="paper-card rounded-xl p-4">
        {take.vote && <p data-testid={`take-vote-${take.id}`} data-vote={take.vote} className={`text-xs font-black uppercase tracking-wide ${take.vote === "up" ? "text-[#c03500]" : "text-[#4f4fd8]"}`}>{take.vote === "up" ? "▲ upvoted this law" : "▼ downvoted this law"}</p>}
        <p className="leading-relaxed mt-1">{take.body}</p>
        <button data-testid={`upvote-${take.id}`} onClick={() => upvote(take.id)} className="mt-3 text-sm font-black hover:underline">▲ {take.upvoteCount}</button>
      </article>)}
      {takes.length === 0 && <p className="text-sm text-[#68736d]">No case yet. Make the first one.</p>}
    </div>
  </section>;
}
