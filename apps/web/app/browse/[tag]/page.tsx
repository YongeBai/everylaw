import { notFound } from "next/navigation";
import { LawCard } from "@/components/law-card";
import { getTaggedLaws } from "@/lib/data";

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params; const result = await getTaggedLaws(tag); if (!result) notFound();
  return <main className="shell py-16"><p className="eyebrow">Topic collection</p><h1 className="serif text-5xl font-black mt-3">{result.name}</h1><p className="mt-4 text-[#59645e]">Federal statutes grouped for exploration—not legal classification.</p><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">{result.laws.map((law) => <LawCard key={law.id} law={law} />)}</div></main>;
}
