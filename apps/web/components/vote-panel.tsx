"use client";

import { useEffect, useState } from "react";

type Counts = { keepCount: number; dissolveCount: number; totalCount: number; dissolveRatio: number; direction?: string };

export function VotePanel({ nodeId, initial }: { nodeId: number; initial: Counts }) {
  const [counts, setCounts] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/vote?nodeId=${nodeId}`, { signal: controller.signal }).then(async (response) => {
      if (response.ok) setCounts(await response.json());
    }).catch((fetchError) => { if (fetchError instanceof Error && fetchError.name !== "AbortError") setError("Could not refresh vote totals"); });
    return () => controller.abort();
  }, [nodeId]);
  async function vote(direction: "keep"|"dissolve") {
    setPending(true); setError("");
    const response = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction }) });
    const result = await response.json();
    if (response.ok) setCounts(result);
    else setError(result.error || "Vote failed");
    setPending(false);
  }
  const dissolvePercent = counts.totalCount ? Math.round(counts.dissolveRatio * 100) : 50;
  return <section data-testid="vote-panel" data-node-id={nodeId} className="paper-card rounded-3xl p-6 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Your verdict</p><h2 className="serif text-3xl font-black mt-1">Should this law survive?</h2></div><p className="text-sm text-[#68736d]">{counts.totalCount.toLocaleString()} public signals</p></div>
    <div className="grid grid-cols-2 gap-3 mt-6"><button data-testid="vote-keep" disabled={pending} onClick={() => vote("keep")} className={`button text-white bg-[#ff4500] border-[#c03500] ${counts.direction === "keep" ? "ring-4 ring-[#d9a62e]" : ""}`}>▲ Keep</button><button data-testid="vote-dissolve" disabled={pending} onClick={() => vote("dissolve")} className={`button text-white bg-[#7575e8] border-[#4f4fd8] ${counts.direction === "dissolve" ? "ring-4 ring-[#d9a62e]" : ""}`}>▼ Dissolve</button></div>
    <div className="mt-6 h-4 rounded-full overflow-hidden bg-[#ff4500]" aria-label={`${dissolvePercent}% dissolve`}><div className="h-full bg-[#7575e8] transition-all" style={{ width: `${dissolvePercent}%` }} /></div>
    <div className="flex justify-between mt-2 text-sm font-bold"><span className="text-[#c03500]">{counts.keepCount} keep</span><span className="text-[#4f4fd8]">{counts.dissolveCount} dissolve</span></div>
    {counts.direction && <a data-testid="vote-next-random" href="/r/random" className="mt-4 inline-block font-bold underline">Next: judge a random law →</a>}
    {error && <p role="alert" className="mt-3 text-sm text-[#b93b2f]">{error}</p>}
  </section>;
}
