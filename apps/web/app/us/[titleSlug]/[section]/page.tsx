import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAiContent, getLaw, getLawNavigation, getTakes, lawUrl } from "@/lib/data";
import { parseHistory } from "@/lib/history";
import { VotePanel } from "@/components/vote-panel";
import { TakesBoard } from "@/components/takes-board";
import { ShareRow } from "@/components/share-row";

type Props = { params: Promise<{ titleSlug: string; section: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titleSlug, section } = await params; const law = await getLaw(titleSlug, decodeURIComponent(section));
  if (!law) return { title: "Law not found" };
  return { title: `${law.citation} — ${law.heading}`, description: `Read ${law.citation} in plain English and vote whether to keep or dissolve it.`, robots: law.featuredTier > 0 ? "index,follow" : "noindex,follow", alternates: { canonical: `/us/${titleSlug}/${section}` }, openGraph: { images: [`/api/og/${law.id}`] } };
}

function AiBlock({ title, body, pending }: { title: string; body?: { body: string }; pending?: string }) {
  if (!body && !pending) return null;
  return <section className="paper-card rounded-2xl p-6"><div className="flex flex-wrap gap-3 items-center"><h2 className="serif text-2xl font-black">{title}</h2>{body && <span className="rounded-full bg-[#f1dfac] px-3 py-1 text-[.65rem] font-black uppercase tracking-wider">AI-assisted · reviewed · not legal advice</span>}</div>
    {body ? <div className="mt-4 leading-relaxed whitespace-pre-line">{body.body}</div> : <p className="mt-4 text-sm leading-relaxed text-[#68736d]">{pending}</p>}</section>;
}

export default async function LawPage({ params }: Props) {
  const { titleSlug, section } = await params; const law = await getLaw(titleSlug, decodeURIComponent(section)); if (!law) notFound();
  const [content, takes, navigation] = await Promise.all([getAiContent(law.id), getTakes(law.id), getLawNavigation(law)]);
  const history = parseHistory(law.sourceCredit);
  const jsonLd = { "@context": "https://schema.org", "@type": "Legislation", name: law.heading, legislationIdentifier: law.citation, jurisdiction: "United States", text: law.bodyText };
  return <main className="shell py-10 md:py-16"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />
    <nav className="text-sm font-bold text-[#68736d]"><Link href="/us">U.S. Code</Link> <span aria-hidden>›</span> <Link href={`/us/${titleSlug}`}>Title {law.title}</Link> <span aria-hidden>›</span> § {law.num}</nav>
    <div className="grid lg:grid-cols-[1fr_23rem] gap-10 items-start mt-7"><article><div className="flex flex-wrap gap-3 items-center"><span className="eyebrow">{law.citation}</span><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${law.status === "active" ? "bg-[#d8eadf] text-[#236348]" : "bg-[#ead8d5] text-[#8b2d24]"}`}>{law.status}</span></div>
      <h1 className="serif text-5xl md:text-6xl font-black mt-3 leading-[1.03]">{law.heading}</h1>
      {content.summary && <p className="mt-6 text-xl leading-relaxed text-[#48564f]">{content.summary.body}</p>}
    </article><VotePanel nodeId={law.id} initial={{ keepCount: law.keepCount, dissolveCount: law.dissolveCount, totalCount: law.totalCount, dissolveRatio: law.dissolveRatio }} /></div>
    <div className="grid lg:grid-cols-[1fr_23rem] gap-10 mt-12"><div className="space-y-6">
      <AiBlock title="Plain-English translation" body={content.explanation} pending="A reviewed plain-English translation hasn't been published for this section yet. The official text below is complete and authoritative." />
      <section className="paper-card rounded-2xl p-6"><div className="flex items-center justify-between gap-4"><h2 className="serif text-2xl font-black">Official text</h2><span className="text-xs text-[#68736d]">{law.wordCount.toLocaleString()} words</span></div><details open={law.wordCount < 4000} className="mt-5"><summary className="font-bold cursor-pointer mb-5">Read the statute</summary><div className="prose-law" dangerouslySetInnerHTML={{ __html: law.bodyHtml }} /></details>{law.sourceCredit && <div className="mt-7 border-t border-[#d5c8b5] pt-5"><p className="eyebrow">Source credit</p><p className="mt-2 text-sm leading-relaxed">{law.sourceCredit}</p></div>}</section>
      <section className="paper-card rounded-2xl p-6" data-testid="law-history"><h2 className="serif text-2xl font-black">History</h2>
        {history.length > 0 ? <ol className="mt-5 space-y-4 border-l-2 border-[#cfc2ae] pl-5">{history.map((entry, index) => <li key={index} className="relative">
          <span className="absolute -left-[1.68rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#236348]" aria-hidden />
          <p className="text-sm font-black uppercase tracking-wide text-[#68736d]">{entry.year ?? "Date unrecorded"} · {entry.kind === "enacted" ? "Enacted" : "Amended"}</p>
          <p className="mt-1 font-bold">{entry.act}{entry.date && entry.act.indexOf(entry.date) === -1 ? ` — ${entry.date}` : ""}</p>
          {entry.statAtLarge && <p className="text-sm text-[#68736d]">{entry.statAtLarge}</p>}
        </li>)}</ol> : <p className="mt-4 text-sm text-[#68736d]">No source credit is recorded for this section, so its enactment history cannot be shown.</p>}
        <div className="mt-6 border-t border-[#d5c8b5] pt-5">
          <div className="flex flex-wrap gap-3 items-center"><h3 className="font-black text-lg">Why this law exists</h3>{content.origin && <span className="rounded-full bg-[#f1dfac] px-3 py-1 text-[.65rem] font-black uppercase tracking-wider">AI-assisted · reviewed · not legal advice</span>}</div>
          {content.origin ? <div className="mt-3 leading-relaxed whitespace-pre-line">{content.origin.body}</div> : <p className="mt-3 text-sm leading-relaxed text-[#68736d]">A reviewed history note hasn't been published for this section yet.{law.enactingPl ? ` The record shows it was enacted by ${law.enactingPl}${law.enactedDate ? ` on ${law.enactedDate}` : ""}.` : ""}</p>}
        </div>
      </section>
    </div><aside className="space-y-5"><AiBlock title="Facts" body={content.facts} /><div className="paper-card rounded-2xl p-5"><p className="eyebrow">At a glance</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>Enacting law</dt><dd className="font-bold text-right">{law.enactingPl || "Unknown"}</dd></div><div className="flex justify-between gap-4"><dt>Enacted</dt><dd className="font-bold">{law.enactedDate || "Unknown"}</dd></div><div className="flex justify-between gap-4"><dt>Amendments on record</dt><dd className="font-bold">{Math.max(0, history.length - 1)}</dd></div><div className="flex justify-between gap-4"><dt>Source references</dt><dd className="font-bold">{law.amendmentCount}</dd></div></dl></div></aside></div>
    <div className="mt-20"><TakesBoard nodeId={law.id} initialTakes={takes} /></div>
    <div className="mt-16 py-8 border-y border-[#cfc2ae]"><ShareRow citation={law.citation} heading={law.heading} /></div>
    <nav className="grid sm:grid-cols-2 gap-5 mt-8">{navigation.previous ? <Link className="paper-card rounded-xl p-5" href={lawUrl(navigation.previous)}><span className="eyebrow">← Previous</span><strong className="block mt-2">{navigation.previous.citation} — {navigation.previous.heading}</strong></Link> : <span />}{navigation.next && <Link className="paper-card rounded-xl p-5 text-right" href={lawUrl(navigation.next)}><span className="eyebrow">Next →</span><strong className="block mt-2">{navigation.next.citation} — {navigation.next.heading}</strong></Link>}</nav>
    {navigation.related.length > 0 && <section className="mt-12"><p className="eyebrow">Related in Title {law.title}</p><div className="flex flex-wrap gap-3 mt-4">{navigation.related.map((item) => <Link className="button" key={item.id} href={lawUrl(item)}>{item.citation}</Link>)}</div></section>}
  </main>;
}
