/**
 * Inline term annotation on official statute text.
 *
 * Two sources feed it: statutory defined terms extracted into the
 * defined_terms table (starred; card shows the statute's own definition and
 * links to the defining section + the title wiki), and a small curated list of
 * terms of art below (dotted; editorial notes for terms the statute uses but
 * never defines). Serious register only: where a term is undefined in the
 * displayed section, the note says so.
 */
type TermLocation = { title: number; section: string };
type TermDef = { term: string; definition: string; definedAt?: TermLocation[] };

export const TERM_DEFINITIONS: TermDef[] = [
  { term: "malice aforethought", definition: "A common-law term of art for the mental state that makes a killing murder. Sections that use it rarely define it; federal courts give it content case by case. It does not require hatred or long planning." },
  { term: "special maritime and territorial jurisdiction of the United States", definition: "A defined term — see 18 U.S.C. § 7 — covering places such as U.S. vessels on the high seas, federal lands and buildings, and certain aircraft. Federal criminal law often reaches only these places; states cover the rest.", definedAt: [{ title: 18, section: "7" }] },
  { term: "lying in wait", definition: "Watching and waiting in concealment for the victim — a classic marker of premeditation. Listed, not defined, where it appears." },
  { term: "oleomargarine", definition: "The statutory name for margarine, from the era when federal law taxed and regulated it as butter's rival. Defined for food law at 21 U.S.C. § 321a.", definedAt: [{ title: 21, section: "321a" }] },
  { term: "public eating place", definition: "The venue this section regulates — restaurants and similar establishments serving food to the public. The section applies its notice and serving rules there.", definedAt: [{ title: 21, section: "347" }] },
  { term: "misbranded", definition: "A defined term of food and drug law — see 21 U.S.C. § 343 — covering false or misleading labeling and related packaging failures.", definedAt: [{ title: 21, section: "343" }, { title: 21, section: "352" }] },
  { term: "interstate commerce", definition: "Commerce crossing state lines — the constitutional hook that lets Congress regulate an activity. Many federal statutes apply only when this element is present." },
  { term: "whoever", definition: "Statutory drafting's universal subject: any person, and often organizations as well — see 1 U.S.C. § 1 for the default rule that “person” includes corporations and associations." },
  { term: "fine under this title", definition: "A cross-reference to the general federal fine schedule at 18 U.S.C. § 3571, which sets maximum fines by offense class rather than in each section.", definedAt: [{ title: 18, section: "3571" }] },
  { term: "person", definition: "Under the Dictionary Act, 1 U.S.C. § 1, “person” presumptively includes corporations, companies, associations, firms, partnerships, societies, and joint stock companies as well as individuals.", definedAt: [{ title: 1, section: "1" }] },
];

type HighlightContext = {
  title?: number;
  section?: string;
  /** Terms already governed by a statutory definition on this page. */
  excludeTerms?: Iterable<string>;
};

const isWordChar = (ch: string | undefined) => ch !== undefined && /[\w’']/.test(ch);

/**
 * Mark the first occurrence of each term with `render(matchedText)`, matching
 * only inside text (never tag markup) and never inside an existing <mark>.
 * Structural replacement for the old regex-over-raw-HTML approach.
 */
function tokenize(html: string): { tag: boolean; text: string }[] {
  return html
    .split(/(<[^>]*>)/)
    .filter((piece) => piece !== "")
    .map((piece) => ({ tag: piece.startsWith("<"), text: piece }));
}

function markFirstOccurrences(
  bodyHtml: string,
  entries: { term: string; render: (text: string) => string }[],
): string {
  const tokens = tokenize(bodyHtml);
  // Longest term first so "financial institution" beats "institution".
  const queue = [...entries].sort((a, b) => b.term.length - a.term.length);
  for (const { term, render } of queue) {
    const needle = term.toLowerCase();
    let markDepth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const { tag, text } = tokens[i];
      if (tag) {
        if (/^<mark[\s>]/i.test(text)) markDepth++;
        else if (/^<\/mark/i.test(text)) markDepth = Math.max(0, markDepth - 1);
        continue;
      }
      if (markDepth > 0 || text.length < needle.length) continue;
      const lower = text.toLowerCase();
      let at = lower.indexOf(needle);
      while (at !== -1 && (isWordChar(text[at - 1]) || isWordChar(text[at + needle.length]))) {
        at = lower.indexOf(needle, at + 1);
      }
      if (at === -1) continue;
      const matched = text.slice(at, at + needle.length);
      // Re-tokenize the insertion so later terms can't match inside its markup.
      tokens.splice(
        i,
        1,
        { tag: false, text: text.slice(0, at) },
        ...tokenize(render(matched)),
        { tag: false, text: text.slice(at + needle.length) },
      );
      break;
    }
  }
  return tokens.map((token) => token.text).join("");
}

/** Wrap curated terms of art in a dotted marker the client can bind. */
export function highlightTerms(bodyHtml: string, context: HighlightContext = {}): string {
  const excluded = new Set(Array.from(context.excludeTerms ?? [], (term) => term.toLocaleLowerCase()));
  return markFirstOccurrences(
    bodyHtml,
    TERM_DEFINITIONS.filter(({ term, definedAt }) => {
      if (excluded.has(term.toLocaleLowerCase())) return false;
      return !definedAt?.some((location) => location.title === context.title && location.section.toLocaleLowerCase() === context.section?.toLocaleLowerCase());
    }).map(({ term }) => ({
      term,
      render: (text) => `<mark class="law-term" data-term="${term}" role="button" tabindex="0">${text}</mark>`,
    })),
  );
}

/** Star statutory defined terms; the id keys the card the client shows. */
export function markDefinedTerms(bodyHtml: string, terms: { id: number; term: string }[]): string {
  return markFirstOccurrences(
    bodyHtml,
    terms.map(({ id, term }) => ({
      term,
      render: (text) =>
        `<mark class="law-term law-term-defined" data-def="${id}" role="button" tabindex="0">${text}<sup aria-hidden="true">*</sup></mark>`,
    })),
  );
}
