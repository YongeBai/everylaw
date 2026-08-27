"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Dealt = { token: string; citation: string; heading: string };
type Result = {
  correct: boolean; wasReal: boolean;
  item: { citation: string; heading: string; url: string | null; enactedYear: string | null; keepCount: number | null; dissolveCount: number | null };
  crowd: { total: number; fooledPct: number };
};

function readBest(): number {
  try { return Number(localStorage.getItem("everylaw_rf_best") ?? 0) || 0; } catch { return 0; }
}
function writeBest(value: number) {
  try { localStorage.setItem("everylaw_rf_best", String(value)); } catch { /* private mode */ }
}

export function RealFakeGame() {
  const [card, setCard] = useState<Dealt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const fetchCard = useCallback(async (): Promise<Dealt | null> => {
    const response = await fetch("/api/realfake");
    return response.ok ? ((await response.json()) as Dealt) : null;
  }, []);

  const deal = useCallback(async () => {
    setResult(null); setError(""); setCopied(false); setCard(null);
    const dealt = await fetchCard();
    if (dealt) setCard(dealt);
    else setError("Could not draw a card. Refresh to retry.");
  }, [fetchCard]);

  useEffect(() => {
    let cancelled = false;
    fetchCard().then((dealt) => {
      if (cancelled) return;
      if (dealt) setCard(dealt);
      else setError("Could not draw a card. Refresh to retry.");
      setBest(readBest());
    });
    return () => { cancelled = true; };
  }, [fetchCard]);

  const guess = useCallback(async (guessReal: boolean) => {
    if (!card || pending || result) return;
    setPending(true); setError("");
    const response = await fetch("/api/realfake", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: card.token, guessReal, website: "" }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) { setError(payload.error || "Could not record the guess"); return; }
    const res = payload as Result;
    setResult(res);
    setScore((s) => ({ right: s.right + (res.correct ? 1 : 0), total: s.total + 1 }));
    setStreak((s) => {
      const next = res.correct ? s + 1 : 0;
      if (next > best) { setBest(next); writeBest(next); }
      return next;
    });
  }, [card, pending, result, best]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (result && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void deal(); return; }
      if (result || !card) return;
      if (event.key === "ArrowLeft") void guess(true);
      if (event.key === "ArrowRight") void guess(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, result, guess, deal]);

  async function share() {
    const text = result?.wasReal
      ? `"${result.item.heading}" is a REAL federal law (${result.item.citation}). I'm on a ${streak}-streak calling real vs. fake laws on EveryLaw — think you can tell? ${window.location.origin}/cantmakeitup`
      : `I'm ${streak} in a row at spotting fake federal laws on EveryLaw. The real ones are weirder than anything they invent. ${window.location.origin}/cantmakeitup`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setError("Clipboard unavailable"); }
  }

  if (!card && !error) return <p className="text-sm text-[#68736d]" data-testid="rf-loading">Shuffling the statute books…</p>;

  return <section data-testid="rf-game">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-sm font-bold">
      <p data-testid="rf-streak">Streak: {streak}{best > 0 && <span className="text-[#68736d] font-normal"> · best {best}</span>}</p>
      {score.total > 0 && <p className="text-[#68736d]" data-testid="rf-score">{score.right}/{score.total} this session</p>}
    </div>

    {card && <div className="paper-card rounded-3xl p-6 md:p-10 text-center" data-testid="rf-card">
      <p className="eyebrow">{result ? result.item.citation : card.citation}</p>
      <h2 className="serif text-2xl md:text-4xl font-black mt-2 max-w-3xl mx-auto">“{card.heading}”</h2>

      {!result && <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg mx-auto">
        <button data-testid="rf-real" disabled={pending} onClick={() => guess(true)} className="button vote-keep">Real law ←</button>
        <button data-testid="rf-fake" disabled={pending} onClick={() => guess(false)} className="button vote-dissolve">Made up →</button>
      </div>}

      {result && <div className="mt-6" data-testid="rf-reveal">
        <p className={`serif text-3xl font-black ${result.correct ? "text-[#236348]" : "text-[#b93b2f]"}`} data-testid={result.correct ? "rf-correct" : "rf-wrong"}>
          {result.correct ? "Called it." : "Fooled you."}
        </p>
        <p className="mt-3 font-bold">
          {result.wasReal
            ? <>This is real federal law{result.item.enactedYear ? `, on the books since ${result.item.enactedYear}` : ""}: <span className="text-[#68736d]">{result.item.citation}</span>.</>
            : <>We made it up. Congress hasn&apos;t. Yet.</>}
        </p>
        {result.crowd.total > 1 && <p className="mt-2 text-sm text-[#68736d]" data-testid="rf-crowd">This card has fooled {result.crowd.fooledPct}% of {result.crowd.total.toLocaleString()} players.</p>}
        {result.wasReal && result.item.url && <p className="mt-4 text-sm">
          <Link href={result.item.url} className="font-bold underline">Read it — then decide if it should stay →</Link>
          {(result.item.keepCount ?? 0) + (result.item.dissolveCount ?? 0) > 0 && <span className="text-[#68736d]"> ({result.item.keepCount} keep · {result.item.dissolveCount} dissolve so far)</span>}
        </p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button data-testid="rf-next" onClick={() => void deal()} className="button button-dark">Next card ⏎</button>
          {streak >= 3 && <button data-testid="rf-share" onClick={share} className="button">{copied ? "Copied — paste it anywhere" : `Share your ${streak}-streak`}</button>}
        </div>
      </div>}
    </div>}

    {error && <p role="alert" className="mt-3 text-sm text-[#b93b2f]">{error}</p>}
    <p className="mt-5 text-sm text-[#68736d]">← real, → made up. Every real card links to the actual statute so you can rule on it for keeps.</p>
  </section>;
}
