import type { Metadata } from "next";
import Link from "next/link";
import { MatchupDeck } from "@/components/matchup-deck";

export const metadata: Metadata = {
  title: "Jury duty — serve a term, judge the laws",
  description: "Serve an eight-case jury term. Two laws face you at a time: save one, let the other go. Blind-justice mode hides their identities until you rule.",
};

export default function RatePage() {
  return <main className="shell py-10">
    <p className="eyebrow">Jury duty</p>
    <h1 className="serif text-4xl md:text-5xl font-black mt-1">The People are in session.</h1>
    <p className="mt-3 max-w-2xl text-[#3d4742]">Serve a term: eight cases, two laws each. Save the one you&apos;d keep — the other slips toward the condemned wing of the code. Flip on <span className="font-bold">⚖ blind justice</span> to judge the rule, not the reputation. Finish a term and your verdicts become part of <Link href="/me" className="underline font-bold">your Constitution</Link>.</p>
    <div className="mt-8"><MatchupDeck /></div>
    <p className="mt-10 text-xs text-[#68736d]">Official text is public domain. AI translations are reviewed and are not legal advice.</p>
  </main>;
}
