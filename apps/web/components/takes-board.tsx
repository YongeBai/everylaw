"use client";

import { useState } from "react";

type Take = { id: number; stance: "keep"|"dissolve"; body: string; upvoteCount: number; createdAt: string };

export function TakesBoard({ nodeId, initialTakes }: { nodeId: number; initialTakes: Take[] }) {
  const [takes, setTakes] = useState(initialTakes);
  const [stance, setStance] = useState<"keep"|"dissolve">("keep");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/takes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, stance, body, website: "" }) });
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
      <div className="flex gap-2"><button type="button" onClick={() => setStance("keep")} className={`button py-2 ${stance === "keep" ? "vote-keep" : ""}`}>Keep because…</button><button type="button" onClick={() => setStance("dissolve")} className={`button py-2 ${stance === "dissolve" ? "vote-dissolve" : ""}`}>Dissolve because…</button></div>
      <label className="sr-only" htmlFor="take-body">Your argument</label><textarea data-testid="take-body" id="take-body" required minLength={3} maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`${stance === "keep" ? "Keep" : "Dissolve"} because…`} className="mt-4 w-full min-h-24 resize-y rounded-xl border border-[#b8aa94] p-4 bg-white outline-none focus:ring-2 focus:ring-[#d9a62e]" />
      <div className="flex justify-between items-center mt-2"><span className="text-xs text-[#68736d]">{body.length}/280</span><button data-testid="submit-take" className="button button-dark">Publish case</button></div>
      {message && <p role="status" className="mt-3 text-sm font-bold">{message}</p>}
    </form>
    <div className="grid md:grid-cols-2 gap-6 mt-8">{(["keep", "dissolve"] as const).map((side) => <div key={side}><h3 className={`serif text-2xl font-black ${side === "keep" ? "text-[#236348]" : "text-[#b93b2f]"}`}>{side === "keep" ? "Keep it" : "Dissolve it"}</h3>
      <div className="space-y-3 mt-4">{takes.filter((take) => take.stance === side).map((take) => <article data-testid="take" key={take.id} className="paper-card rounded-xl p-4"><p className="leading-relaxed">{take.body}</p><button data-testid={`upvote-${take.id}`} onClick={() => upvote(take.id)} className="mt-3 text-sm font-black hover:underline">▲ {take.upvoteCount}</button></article>)}
      {takes.every((take) => take.stance !== side) && <p className="text-sm text-[#68736d]">No case yet. Make the first one.</p>}</div></div>)}</div>
  </section>;
}
