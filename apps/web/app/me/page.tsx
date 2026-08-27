import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@everylaw/db";
import { hashValue } from "@/lib/security";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = {
  title: "Your Constitution — the law according to you",
  description: "Serve a full jury term and EveryLaw drafts your civic self-portrait: what you keep, what you cut, how often you dissent.",
};
export const dynamic = "force-dynamic";

const UNLOCK_AT = 8;

type Archetype = { name: string; description: string };

function archetypeFor(input: { dissolveInclination: number | null; dissentRate: number; underdogRate: number; judgments: number }): Archetype {
  const { dissolveInclination, dissentRate, underdogRate } = input;
  if (dissentRate >= 0.4) return { name: "The Contrarian Juror", description: "Where the majority sees a settled question, you file a dissent. Courts remembered their dissenters more than their majorities." };
  if (underdogRate >= 0.6) return { name: "The Underdog's Advocate", description: "You keep siding with the laws the crowd is letting slip. Somebody has to read the fine print before it burns." };
  if (dissolveInclination !== null && dissolveInclination >= 0.65) return { name: "The Abolitionist", description: "Your constitution is a short document. You'd rather live with fewer rules, honestly kept, than a warehouse of dead letters." };
  if (dissolveInclination !== null && dissolveInclination <= 0.3) return { name: "The Archivist", description: "You keep nearly everything — every law is a record of something that once went wrong. You'd rather understand a rule than erase it." };
  return { name: "The Gardener", description: "You prune with intent: dead wood goes, roots stay. If everyone judged like you, the code would shrink slowly and make more sense every year." };
}

export default async function YourConstitutionPage() {
  const cookieStore = await cookies();
  const voterCookie = cookieStore.get("everylaw_voter")?.value;
  const voterHash = voterCookie ? hashValue(voterCookie) : null;

  const locked = async (judged: number) => <main className="shell py-10">
    <p className="eyebrow">Your Constitution</p>
    <h1 className="serif text-4xl md:text-5xl font-black mt-1">Still being drafted.</h1>
    <p className="mt-3 max-w-2xl text-[#3d4742]">Serve one full jury term — {UNLOCK_AT} judgments — and EveryLaw drafts the law according to you: what you keep, what you cut, how often you stand against the majority.</p>
    <div className="mt-8 max-w-md" data-testid="constitution-locked">
      <div className="h-4 rounded-full overflow-hidden bg-[#e7ddcb]"><div className="h-full bg-[#236348] transition-all" style={{ width: `${Math.min(100, (judged / UNLOCK_AT) * 100)}%` }} /></div>
      <p className="mt-2 text-sm font-bold">{judged} of {UNLOCK_AT} judgments served</p>
    </div>
    <Link href="/rate" className="button button-dark mt-6 inline-block">Report for jury duty →</Link>
  </main>;

  if (!voterHash) return locked(0);

  const [mine] = await db.execute(sql`SELECT count(*)::int judged FROM matchup_votes WHERE voter_hash = ${voterHash}`);
  const judged = Number(mine!.judged);
  if (judged < UNLOCK_AT) return locked(judged);

  const [direct, underdog, dissent, slants] = await Promise.all([
    db.execute(sql`
      SELECT count(*) FILTER (WHERE direction = 'dissolve')::int dissolve, count(*)::int total
      FROM votes WHERE voter_hash = ${voterHash}
    `),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE COALESCE(we.elo, 1500) < COALESCE(le.elo, 1500))::int underdog, count(*)::int total
      FROM matchup_votes mv
      LEFT JOIN elo_ratings we ON we.node_id = mv.winner_node_id
      LEFT JOIN elo_ratings le ON le.node_id = mv.loser_node_id
      WHERE mv.voter_hash = ${voterHash}
    `),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE pct < 0.5)::int dissents, count(*) FILTER (WHERE n > 1)::int contested
      FROM (
        SELECT (SELECT count(*) FILTER (WHERE w2.winner_node_id = mv.winner_node_id)::float / count(*)
                FROM matchup_votes w2
                WHERE (w2.winner_node_id = mv.winner_node_id AND w2.loser_node_id = mv.loser_node_id)
                   OR (w2.winner_node_id = mv.loser_node_id AND w2.loser_node_id = mv.winner_node_id)) pct,
               (SELECT count(*)
                FROM matchup_votes w2
                WHERE (w2.winner_node_id = mv.winner_node_id AND w2.loser_node_id = mv.loser_node_id)
                   OR (w2.winner_node_id = mv.loser_node_id AND w2.loser_node_id = mv.winner_node_id)) n
        FROM matchup_votes mv WHERE mv.voter_hash = ${voterHash}
      ) pair_stats
    `),
    db.execute(sql`
      SELECT t.name, t.slug,
        count(*) FILTER (WHERE nt.node_id = mv.winner_node_id)::int kept,
        count(*)::int faced
      FROM matchup_votes mv
      JOIN node_tags nt ON nt.node_id = mv.winner_node_id OR nt.node_id = mv.loser_node_id
      JOIN tags t ON t.id = nt.tag_id
      WHERE mv.voter_hash = ${voterHash}
      GROUP BY t.name, t.slug
      HAVING count(*) >= 2
      ORDER BY count(*) DESC
      LIMIT 6
    `),
  ]);

  const directTotal = Number(direct[0]!.total);
  const dissolveInclination = directTotal > 0 ? Number(direct[0]!.dissolve) / directTotal : null;
  const underdogTotal = Number(underdog[0]!.total);
  const underdogRate = underdogTotal > 0 ? Number(underdog[0]!.underdog) / underdogTotal : 0;
  const contested = Number(dissent[0]!.contested);
  const dissentRate = contested > 0 ? Number(dissent[0]!.dissents) / contested : 0;
  const archetype = archetypeFor({ dissolveInclination, dissentRate, underdogRate, judgments: judged });

  const shareText = `The law according to me, after ${judged} judgments on EveryLaw: I'm ${archetype.name}. I dissent from the majority ${Math.round(dissentRate * 100)}% of the time and back the underdog ${Math.round(underdogRate * 100)}% of the time. Draft yours: `;

  return <main className="shell py-10">
    <p className="eyebrow">Your Constitution</p>
    <h1 className="serif text-4xl md:text-5xl font-black mt-1" data-testid="constitution-archetype">{archetype.name}</h1>
    <p className="mt-3 max-w-2xl text-[#3d4742]">{archetype.description}</p>

    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="paper-card rounded-2xl p-5 text-center"><p className="serif text-4xl font-black">{judged}</p><p className="text-xs font-bold text-[#68736d] mt-1">career judgments</p></div>
      <div className="paper-card rounded-2xl p-5 text-center"><p className="serif text-4xl font-black text-[#b93b2f]">{Math.round(dissentRate * 100)}%</p><p className="text-xs font-bold text-[#68736d] mt-1">dissent rate on contested cases</p></div>
      <div className="paper-card rounded-2xl p-5 text-center"><p className="serif text-4xl font-black text-[#236348]">{Math.round(underdogRate * 100)}%</p><p className="text-xs font-bold text-[#68736d] mt-1">rulings for the underdog</p></div>
      <div className="paper-card rounded-2xl p-5 text-center"><p className="serif text-4xl font-black">{dissolveInclination === null ? "—" : `${Math.round(dissolveInclination * 100)}%`}</p><p className="text-xs font-bold text-[#68736d] mt-1">of your page verdicts say dissolve</p></div>
    </div>

    {slants.length > 0 && <section className="mt-10">
      <h2 className="serif text-2xl font-black">Where you draw your lines</h2>
      <p className="text-sm text-[#68736d] mt-1">How often you save a law when its category comes before you.</p>
      <div className="mt-4 space-y-3 max-w-2xl" data-testid="constitution-slants">
        {slants.map((row) => {
          const kept = Number(row.kept); const faced = Number(row.faced);
          const pct = Math.round((kept / faced) * 100);
          return <div key={String(row.slug)}>
            <div className="flex justify-between text-sm font-bold"><Link className="hover:text-[#b93b2f]" href={`/browse/${String(row.slug)}`}>{String(row.name)}</Link><span>{pct}% saved <span className="text-[#68736d] font-normal">({kept}/{faced})</span></span></div>
            <div className="mt-1 h-3 rounded-full overflow-hidden bg-[#e7ddcb]"><div className="h-full bg-[#236348]" style={{ width: `${pct}%` }} /></div>
          </div>;
        })}
      </div>
    </section>}

    <div className="mt-10 flex flex-wrap items-center gap-3">
      <CopyButton text={`${shareText}${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/rate`} label="Share your Constitution" />
      <Link href="/rate" className="button button-dark">Serve another term →</Link>
    </div>
    <p className="mt-6 text-xs text-[#68736d]">Drafted from your anonymous judgments on this device. Underdog rulings are measured against today&apos;s standings. Clear your cookies and the record starts fresh.</p>
  </main>;
}
