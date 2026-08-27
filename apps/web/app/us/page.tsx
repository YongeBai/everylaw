import Link from "next/link";
import { getTitles } from "@/lib/data";

export const metadata = { title: "Browse the U.S. Code" };

export default async function Browse() {
  const titles = await getTitles();
  return <main className="shell py-16"><p className="eyebrow">The United States Code</p><h1 className="serif text-5xl font-black mt-3">Browse all titles</h1>
    <p className="mt-4 text-[#59645e] max-w-2xl">Codified federal statutes, organized the way Congress publishes them. Repealed and reserved sections remain visible because history still gets cited.</p>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">{titles.map((title) => <Link className="paper-card rounded-xl p-5 hover:border-[#13241d]" href={`/us/title-${title.num}`} prefetch={false} key={title.id}>
      <span className="eyebrow">Title {title.num}</span><h2 className="serif text-xl font-black mt-2">{title.heading}</h2><p className="mt-3 text-sm text-[#68736d]">{title.sectionCount.toLocaleString()} sections</p>
    </Link>)}</div>
  </main>;
}
