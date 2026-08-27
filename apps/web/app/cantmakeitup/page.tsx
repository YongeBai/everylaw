import type { Metadata } from "next";
import Link from "next/link";
import { RealFakeGame } from "@/components/realfake-game";

export const metadata: Metadata = {
  title: "Can't Make It Up — real law or made up?",
  description: "One law at a time: is it a real federal statute or did we invent it? The real ones are weirder. Build a streak, then go rule on the real ones.",
};

export default function CantMakeItUpPage() {
  return <main className="shell py-10">
    <p className="eyebrow">Can&apos;t make it up</p>
    <h1 className="serif text-4xl md:text-5xl font-black mt-1">Real law, or did we invent it?</h1>
    <p className="mt-3 max-w-2xl text-[#3d4742]">There are over 60,000 sections of federal law. Some of them sound fake. Some of our fakes sound real — when we invented decoys for this game, several turned out to already be actual laws. Call them right, build a streak, and every real card leads to the statute itself, where you can <Link href="/rate" className="underline font-bold">rule on whether it stays</Link>.</p>
    <div className="mt-8"><RealFakeGame /></div>
    <p className="mt-10 text-xs text-[#68736d]">Guesses are anonymous. Real cards quote actual US Code headings, public domain. Decoys are fiction — please don&apos;t cite them in court.</p>
  </main>;
}
