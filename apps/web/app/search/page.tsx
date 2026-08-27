import { SearchBox } from "@/components/search-box";
import { LawCard } from "@/components/law-card";
import { searchLaws } from "@/lib/data";

export const metadata = { title: "Search federal law" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.slice(0, 100) || ""; const results = query ? await searchLaws(query) : [];
  return <main className="shell py-16"><p className="eyebrow">Find the rule behind the headline</p><h1 className="serif text-5xl font-black mt-3">Search federal law</h1><div className="mt-8 max-w-3xl"><SearchBox large /></div>
    {query && <section className="mt-12"><p className="text-[#68736d]">{results.length} results for <strong className="text-[#13241d]">“{query}”</strong></p><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">{results.map((law) => <LawCard law={law} key={law.id} />)}</div>{results.length === 0 && <p className="paper-card rounded-xl p-6 mt-6">No matching section yet. Try a shorter phrase or citation.</p>}</section>}
  </main>;
}
