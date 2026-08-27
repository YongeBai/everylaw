import Link from "next/link";
import { notFound } from "next/navigation";
import { getTitleSectionCount, getTitleSections, lawUrl } from "@/lib/data";

export default async function TitlePage({ params, searchParams }: { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { titleSlug } = await params;
  if (!/^title-\d+$/.test(titleSlug)) notFound();
  const pageSize = 200; const requestedPage = Number((await searchParams).page || 1); const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [laws, total] = await Promise.all([getTitleSections(titleSlug, pageSize, (page - 1) * pageSize), getTitleSectionCount(titleSlug)]); const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <main className="shell py-16"><Link href="/us" className="eyebrow">← All titles</Link><h1 className="serif text-5xl font-black mt-3">Title {titleSlug.replace("title-", "")}</h1>
    <div className="paper-card rounded-2xl overflow-hidden mt-10">{laws.map((law) => <Link className="grid sm:grid-cols-[10rem_1fr_auto] gap-3 px-5 py-4 border-b border-[#dfd3c0] last:border-0 hover:bg-[#fff8ec]" href={lawUrl(law)} prefetch={false} key={law.id}>
      <span className="font-black">§ {law.num}</span><span>{law.heading}</span><span className="text-xs uppercase text-[#68736d]">{law.status}</span>
    </Link>)}</div>
    <nav className="flex justify-between items-center mt-6" aria-label="Title pages">{page > 1 ? <Link className="button" prefetch={false} href={`/us/${titleSlug}?page=${page - 1}`}>← Previous 200</Link> : <span />}<span className="text-sm font-bold">Page {page} of {pageCount}</span>{page < pageCount ? <Link className="button" prefetch={false} href={`/us/${titleSlug}?page=${page + 1}`}>Next 200 →</Link> : <span />}</nav>
  </main>;
}
