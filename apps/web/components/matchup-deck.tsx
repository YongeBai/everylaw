"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const TERM_LENGTH = 8;

type Card = {
  id: number; citation: string; heading: string; summary: string; url: string;
  elo: number; matches: number; keepCount: number; dissolveCount: number;
};
type Pair = { pair: Card[]; totalMatchupVotes: number };
type Reveal = {
  winner: { id: number; elo: number; delta: number };
  loser: { id: number; elo: number; delta: number };
  agreementPct: number; pairVotes: number; totalMatchupVotes: number; yourJudgments: number;
};
type Judgment = {
  saved: Card; condemned: Card;
  dissented: boolean; underdog: boolean; agreementPct: number; pairVotes: number;
};

async function dealPair(): Promise<Pair | null> {
  const response = await fetch("/api/matchup");
  return response.ok ? response.json() : null;
}

export function MatchupDeck() {
  const [pair, setPair] = useState<Card[] | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [termDone, setTermDone] = useState(false);
  const [blind, setBlind] = useState(false);
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const [yourJudgments, setYourJudgments] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const nextRef = useRef<Pair | null>(null);

  const advance = useCallback(async () => {
    setReveal(null); setChosenId(null); setError(""); setCopied(false);
    const next = nextRef.current; nextRef.current = null;
    if (next) { setPair(next.pair); return; }
    const dealt = await dealPair();
    if (dealt) { setPair(dealt.pair); setTotalVotes(dealt.totalMatchupVotes); }
    else setError("Could not summon the next case. Refresh to retry.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    dealPair().then((dealt) => {
      if (cancelled) return;
      if (dealt) { setPair(dealt.pair); setTotalVotes(dealt.totalMatchupVotes); }
      else setError("Could not summon the next case. Refresh to retry.");
    });
    return () => { cancelled = true; };
  }, []);

  const next = useCallback(async () => {
    if (judgments.length >= TERM_LENGTH) { setTermDone(true); setReveal(null); return; }
    await advance();
  }, [judgments.length, advance]);

  const pick = useCallback(async (winner: Card, loser: Card) => {
    if (pending || reveal || termDone) return;
    setPending(true); setError(""); setChosenId(winner.id);
    const response = await fetch("/api/matchup", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ winnerId: winner.id, loserId: loser.id, website: "" }),
    });
    const result = await response.json();
    setPending(false);
    if (response.ok) {
      const revealData = result as Reveal;
      setReveal(revealData);
      setTotalVotes(revealData.totalMatchupVotes);
      setYourJudgments(revealData.yourJudgments);
      setJudgments((list) => [...list, {
        saved: winner, condemned: loser,
        dissented: revealData.pairVotes > 1 && revealData.agreementPct < 50,
        underdog: winner.elo < loser.elo,
        agreementPct: revealData.agreementPct, pairVotes: revealData.pairVotes,
      }]);
      void dealPair().then((dealt) => { nextRef.current = dealt; });
    } else if (response.status === 409) {
      void advance(); // this juror already ruled on that pairing — deal a fresh case
    } else {
      setChosenId(null); setError(result.error || "Could not record your judgment");
    }
  }, [pending, reveal, termDone, advance]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!pair || termDone) return;
      if (reveal && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void next(); return; }
      if (reveal) return;
      if (event.key === "ArrowLeft") void pick(pair[0], pair[1]);
      if (event.key === "ArrowRight") void pick(pair[1], pair[0]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pair, reveal, termDone, pick, next]);

  function newTerm() {
    setJudgments([]); setTermDone(false); setCopied(false);
    void advance();
  }

  async function shareTerm() {
    const dissents = judgments.filter((j) => j.dissented).length;
    const underdogs = judgments.filter((j) => j.underdog).length;
    const text = `I just served a jury term on EveryLaw: saved ${judgments.length} laws, condemned ${judgments.length}, dissented from the majority ${dissents}× and backed the underdog ${underdogs}×. Which laws would YOU keep? ${window.location.origin}/rate`;
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError("Could not copy — clipboard unavailable"); }
  }

  if (termDone) {
    const dissents = judgments.filter((j) => j.dissented).length;
    const underdogs = judgments.filter((j) => j.underdog).length;
    const boldest = [...judgments].filter((j) => j.pairVotes > 1).sort((a, b) => a.agreementPct - b.agreementPct)[0];
    return <section data-testid="deck-verdict" className="paper-card rounded-3xl p-6 md:p-10">
      <p className="eyebrow">Term complete</p>
      <h2 className="serif text-3xl md:text-4xl font-black mt-1">Your verdicts are entered into the record.</h2>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div><p className="serif text-4xl font-black">{judgments.length}</p><p className="text-xs font-bold text-[#68736d] mt-1">cases judged</p></div>
        <div><p className="serif text-4xl font-black text-[#b93b2f]">{dissents}</p><p className="text-xs font-bold text-[#68736d] mt-1">dissents from the majority</p></div>
        <div><p className="serif text-4xl font-black text-[#236348]">{underdogs}</p><p className="text-xs font-bold text-[#68736d] mt-1">underdogs backed</p></div>
        <div><p className="serif text-4xl font-black">{yourJudgments ?? judgments.length}</p><p className="text-xs font-bold text-[#68736d] mt-1">career judgments</p></div>
      </div>
      {boldest && <p className="mt-6 text-sm"><span className="font-black">Boldest ruling:</span> only {boldest.agreementPct}% of judges agreed when you saved <span className="font-bold">{boldest.saved.heading}</span> over <span className="font-bold">{boldest.condemned.heading}</span>.</p>}
      <div className="mt-6 grid md:grid-cols-2 gap-4 text-sm">
        <div><p className="font-black text-[#236348] mb-2">You saved</p><ul className="space-y-1">{judgments.map((j, i) => <li key={i} className="truncate">• {j.saved.heading}</li>)}</ul></div>
        <div><p className="font-black text-[#b93b2f] mb-2">You let go</p><ul className="space-y-1">{judgments.map((j, i) => <li key={i} className="truncate text-[#68736d]">• {j.condemned.heading}</li>)}</ul></div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button data-testid="verdict-again" onClick={newTerm} className="button button-dark">Serve another term</button>
        <button data-testid="verdict-share" onClick={shareTerm} className="button">{copied ? "Copied — paste it anywhere" : "Share your term"}</button>
        {(yourJudgments ?? 0) >= TERM_LENGTH && <Link data-testid="verdict-constitution" href="/me" className="font-bold underline">Your Constitution is ready →</Link>}
      </div>
    </section>;
  }

  if (!pair) return <p className="text-sm text-[#68736d]" data-testid="deck-loading">{error || "Summoning the next case…"}</p>;

  return <section data-testid="matchup-deck">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-sm font-bold">
      <p data-testid="deck-streak">Judgment {Math.min(judgments.length + 1, TERM_LENGTH)} of {TERM_LENGTH} this term</p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="deck-blind-toggle">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="accent-[#1f2a25]" />
          <span title="Judge the rule, not the reputation: identities are revealed after you rule.">⚖ Blind justice</span>
        </label>
        {totalVotes !== null && <p className="text-[#68736d]" data-testid="deck-total">{totalVotes.toLocaleString()} judgments entered by the People</p>}
      </div>
    </div>
    <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
      {pair.map((card, index) => {
        const other = pair[1 - index];
        const revealSide = reveal && (card.id === reveal.winner.id ? reveal.winner : card.id === reveal.loser.id ? reveal.loser : null);
        const isChosen = chosenId === card.id;
        const masked = blind && !reveal;
        return <button
          key={card.id}
          data-testid={`matchup-card-${index}`}
          disabled={pending || Boolean(reveal)}
          onClick={() => pick(card, other)}
          className={`paper-card rounded-3xl p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d9a62e] ${isChosen ? "ring-4 ring-[#236348]" : ""} ${reveal && !isChosen ? "opacity-70" : ""}`}
        >
          <p className="eyebrow">{masked ? `Sealed case ${index === 0 ? "A" : "B"}` : card.citation}</p>
          <h2 className="serif text-2xl font-black mt-1">{masked ? "Identity under seal" : card.heading}</h2>
          <p className="mt-3 text-sm text-[#3d4742] line-clamp-4">{card.summary}</p>
          {!masked && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[#68736d]">
            <span className="text-[#236348]">{card.keepCount} keep</span>
            <span className="text-[#b93b2f]">{card.dissolveCount} dissolve</span>
            <span>{card.matches + (revealSide ? 1 : 0)} prior matchups</span>
          </div>}
          {revealSide && <p data-testid={revealSide.delta >= 0 ? "reveal-winner" : "reveal-loser"} className={`mt-3 text-sm font-black ${revealSide.delta >= 0 ? "text-[#236348]" : "text-[#b93b2f]"}`}>
            {revealSide.delta >= 0 ? "▲ Saved — its standing with the People rises" : "▼ Let go — it slips toward the condemned wing"}
          </p>}
        </button>;
      })}
      <div aria-hidden className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-[#1f2a25] text-[#f5f0e6] text-xs font-black">VS</div>
    </div>
    {reveal && <div data-testid="deck-reveal" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="font-bold">{reveal.pairVotes <= 1 ? "You're the first juror to rule on this pairing." : reveal.agreementPct < 50 ? `Dissent: only ${reveal.agreementPct}% of ${reveal.pairVotes.toLocaleString()} jurors ruled your way.` : `${reveal.agreementPct}% of ${reveal.pairVotes.toLocaleString()} jurors ruled with you.`}</p>
      <button data-testid="deck-next" onClick={() => void next()} className="button">{judgments.length >= TERM_LENGTH ? "See your term verdict ⏎" : "Next case ⏎"}</button>
    </div>}
    {!reveal && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#68736d]">
      <p>← and → to rule. Recused? <button data-testid="deck-skip" className="underline font-bold" onClick={() => void advance()}>Pass the case</button>.</p>
      <Link href="/r/random" className="font-bold underline">Judge random laws →</Link>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-[#b93b2f]">{error}</p>}
  </section>;
}
