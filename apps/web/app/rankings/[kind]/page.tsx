import Link from "next/link";
import { notFound } from "next/navigation";
import { LawCard } from "@/components/law-card";
import { getRankings } from "@/lib/data";

const labels: Record<string, string> = { "most-dissolved": "Most wanted dissolved", "most-loved": "Most loved", "most-contested": "Most contested", "most-voted": "Most voted" };
export default async function Rankings({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params; if (!labels[kind]) notFound(); const laws = await getRankings(kind);
  return <main className="shell py-16"><p className="eyebrow">Public signals · live</p><h1 className="serif text-5xl font-black mt-3">{labels[kind]}</h1>
    <nav className="flex gap-2 flex-wrap mt-7">{Object.entries(labels).map(([slug, label]) => <Link className={`button py-2 ${kind === slug ? "button-dark" : ""}`} key={slug} href={`/rankings/${slug}`}>{label}</Link>)}</nav>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">{laws.map((law, index) => <LawCard key={law.id} law={law} rank={index + 1} />)}</div>{laws.length === 0 && <p className="paper-card p-6 rounded-xl mt-10">No votes yet. The rankings wake up with the first signal.</p>}
  </main>;
}
