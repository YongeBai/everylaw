import Link from "next/link";
import { lawUrl, type LawSummary } from "@/lib/data";

export function LawCard({ law, rank }: { law: LawSummary; rank?: number }) {
  const dissolve = Math.round(law.dissolveRatio * 100);
  return <Link href={lawUrl(law)} prefetch={false} className="paper-card rounded-2xl p-5 block hover:-translate-y-1 transition-transform focus-ring">
    <div className="flex justify-between gap-4"><span className="eyebrow">{law.citation}</span>{rank && <span className="serif text-3xl font-black text-[#d6c7ae]">#{rank}</span>}</div>
    <h3 className="serif text-xl font-black mt-2 leading-tight">{law.heading}</h3>
    <div className="mt-5 h-2 rounded-full bg-[#d8e4dc] overflow-hidden"><div className="h-full bg-[#b93b2f]" style={{ width: `${dissolve}%` }} /></div>
    <div className="mt-2 flex justify-between text-xs font-bold text-[#68736d]"><span>{law.keepCount} keep</span><span>{law.dissolveCount} dissolve</span></div>
  </Link>;
}
