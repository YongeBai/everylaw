/**
 * Curated statutory terms of art, surfaced as inline definitions on official
 * text (annotated-edition feature). Serious register only:
 * where a term is undefined in the displayed section, the note says so.
 */
export type TermDef = { term: string; definition: string };

export const TERM_DEFINITIONS: TermDef[] = [
  { term: "malice aforethought", definition: "A common-law term of art for the mental state that makes a killing murder. Sections that use it rarely define it; federal courts give it content case by case. It does not require hatred or long planning." },
  { term: "special maritime and territorial jurisdiction of the United States", definition: "A defined term — see 18 U.S.C. § 7 — covering places such as U.S. vessels on the high seas, federal lands and buildings, and certain aircraft. Federal criminal law often reaches only these places; states cover the rest." },
  { term: "lying in wait", definition: "Watching and waiting in concealment for the victim — a classic marker of premeditation. Listed, not defined, where it appears." },
  { term: "oleomargarine", definition: "The statutory name for margarine, from the era when federal law taxed and regulated it as butter's rival. Defined for food law at 21 U.S.C. § 321a." },
  { term: "public eating place", definition: "The venue this section regulates — restaurants and similar establishments serving food to the public. The section applies its notice and serving rules there." },
  { term: "misbranded", definition: "A defined term of food and drug law — see 21 U.S.C. § 343 — covering false or misleading labeling and related packaging failures." },
  { term: "interstate commerce", definition: "Commerce crossing state lines — the constitutional hook that lets Congress regulate an activity. Many federal statutes apply only when this element is present." },
  { term: "whoever", definition: "Statutory drafting's universal subject: any person, and often organizations as well — see 1 U.S.C. § 1 for the default rule that “person” includes corporations and associations." },
  { term: "fine under this title", definition: "A cross-reference to the general federal fine schedule at 18 U.S.C. § 3571, which sets maximum fines by offense class rather than in each section." },
  { term: "person", definition: "Under the Dictionary Act, 1 U.S.C. § 1, “person” presumptively includes corporations, companies, associations, firms, partnerships, societies, and joint stock companies as well as individuals." },
];

// Compiled once at module load — highlightTerms runs on every law-page render.
// Deliberately non-global: only the FIRST occurrence of each term is marked, so
// common words ("person", "whoever") don't turn the statute into confetti.
const TERM_PATTERNS = TERM_DEFINITIONS.map(({ term }) => ({
  term,
  pattern: new RegExp(`(?<![\\w>])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
}));

/** Wrap known terms in bodyHtml with a marker element the client can bind. */
export function highlightTerms(bodyHtml: string): string {
  let html = bodyHtml;
  for (const { term, pattern } of TERM_PATTERNS) {
    html = html.replace(pattern, (match) => `<mark class="law-term" data-term="${term}" role="button" tabindex="0">${match}</mark>`);
  }
  return html;
}
