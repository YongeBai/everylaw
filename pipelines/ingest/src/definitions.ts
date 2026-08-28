import type { Sql } from 'postgres';

/**
 * Statutory defined-term extraction. US Code sections define terms with a
 * recognizable formula — a scope phrase ("In this title", "As used in this
 * section") followed by `the term “X” means/includes …`. We extract each
 * (term, scope, definition excerpt) from section body_text and resolve the
 * scope word to a concrete ancestor node, so a page can ask "which defined
 * terms reach this section?" with one ltree ancestor query.
 *
 * Derived data: `rebuildDefinedTerms` deletes and re-extracts wholesale, so
 * re-running after any ingest is always safe.
 */

export type ScopeLevel = 'title' | 'part' | 'chapter' | 'subchapter' | 'subpart' | 'division' | 'section';

export type ExtractedDefinition = {
  term: string;
  scope: ScopeLevel;
  definition: string;
};

const MAX_DEFINITION_CHARS = 700;
const MAX_TERM_CHARS = 80;

// Anchors of the definition formula: `term “` (singular or plural).
const TERM_ANCHOR_RE = /\bterms?\s+“/g;
// One quoted term, then optionally more joined by commas / and / or.
const QUOTED_RE = /^“([^”]{1,120})”/;
const JOINER_RE = /^(?:\s*,\s*|\s*,?\s+(?:and|or)\s+)(?=“)/;
// What must follow the quoted term(s) for this to be a definition rather than
// a mere mention. The em-dash form covers `The term “X”— (A) means …`.
const VERB_RE = /^[\s,]*(?:—|(?:shall\s+)?(?:means?|includes?)\b|ha(?:s|ve)\s+the\s+(?:same\s+)?meanings?\b)/;
// Scope phrase. Deliberately excludes bare `of this title`, which is how
// cross-references read (`section 27 of this title`), not how scopes read.
const SCOPE_RE = /\b(?:as\s+used\s+in|in|for\s+(?:the\s+)?purposes?\s+of)\s+this\s+(title|chapter|subchapter|part|subpart|division|section|subsection|paragraph)\b/gi;

const SCOPE_ALIASES: Record<string, ScopeLevel> = {
  title: 'title', part: 'part', chapter: 'chapter', subchapter: 'subchapter',
  subpart: 'subpart', division: 'division',
  section: 'section', subsection: 'section', paragraph: 'section',
};

/** The scope phrase nearest before `index`, defaulting to the narrowest scope. */
function scopeAt(text: string, index: number): ScopeLevel {
  let scope: ScopeLevel = 'section';
  SCOPE_RE.lastIndex = 0;
  for (let m = SCOPE_RE.exec(text); m && m.index < index; m = SCOPE_RE.exec(text)) {
    scope = SCOPE_ALIASES[m[1].toLowerCase()];
  }
  return scope;
}

function excerpt(text: string, start: number, end: number): string {
  let out = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (out.length > MAX_DEFINITION_CHARS) {
    // Prefer ending on a sentence; otherwise cut cleanly at a word break.
    const window = out.slice(0, MAX_DEFINITION_CHARS);
    const sentence = window.lastIndexOf('. ');
    out = sentence > 200 ? window.slice(0, sentence + 1) : `${window.slice(0, window.lastIndexOf(' '))} …`;
  }
  // A definition sliced right before the next enumerated one ends in `; (4)`.
  return out.replace(/[;,]?\s*\(\w{1,4}\)\s*$/, ';').replace(/;$/, ';').trim();
}

export function extractDefinedTerms(bodyText: string): ExtractedDefinition[] {
  const found = new Map<string, ExtractedDefinition>();
  // index: the `term “` anchor; defStart: where the excerpt should begin.
  const anchors: { index: number; terms: string[]; defStart: number }[] = [];

  TERM_ANCHOR_RE.lastIndex = 0;
  for (let m = TERM_ANCHOR_RE.exec(bodyText); m; m = TERM_ANCHOR_RE.exec(bodyText)) {
    // Collect the quoted term list starting at the opening quote.
    const quoteStart = m.index + m[0].length - 1;
    let cursor = quoteStart;
    const terms: string[] = [];
    for (;;) {
      const quoted = QUOTED_RE.exec(bodyText.slice(cursor));
      if (!quoted) break;
      terms.push(quoted[1]);
      cursor += quoted[0].length;
      const joiner = JOINER_RE.exec(bodyText.slice(cursor));
      if (!joiner) break;
      cursor += joiner[0].length;
    }
    if (terms.length === 0 || !VERB_RE.test(bodyText.slice(cursor))) continue;
    // Start at the immediate lead-in ("The term …" rather than "term …").
    const lead = bodyText.toLowerCase().lastIndexOf('the ', m.index);
    anchors.push({ index: m.index, terms, defStart: lead >= 0 && m.index - lead <= 5 ? lead : m.index });
  }

  for (let i = 0; i < anchors.length; i++) {
    const { index, terms, defStart } = anchors[i];
    const scope = scopeAt(bodyText, index);
    // A definition runs until the next definition's lead-in (or the cap).
    const end = i + 1 < anchors.length ? anchors[i + 1].defStart : bodyText.length;
    const definition = excerpt(bodyText, defStart, end);
    for (const raw of terms) {
      const term = raw.trim();
      if (term.length < 2 || term.length > MAX_TERM_CHARS || !/[a-zA-Z]/.test(term)) continue;
      const key = term.toLowerCase();
      if (!found.has(key)) found.set(key, { term, scope, definition });
    }
  }
  return [...found.values()];
}

// ---------------------------------------------------------------------------
// DB rebuild
// ---------------------------------------------------------------------------

type SectionRow = { id: number; level_path: string | null; body_text: string };
type AncestorRow = { id: number; level_path: string; node_type: string };

/** Resolve a scope word to the node it names, walking the level-path ancestry. */
function resolveScopeNode(
  sectionId: number,
  levelPath: string | null,
  scope: ScopeLevel,
  ancestors: Map<string, AncestorRow>,
): number {
  if (scope === 'section' || !levelPath) return sectionId;
  const labels = levelPath.split('.');
  // Deepest ancestor of the named type wins (subchapter inside chapter etc.).
  for (let depth = labels.length - 1; depth >= 1; depth--) {
    const node = ancestors.get(labels.slice(0, depth).join('.'));
    if (node?.node_type === scope) return node.id;
  }
  // Scope names a level this section doesn't sit under (rare, usually a
  // drafting quirk) — fall back to the narrowest safe reach: the section.
  return sectionId;
}

export async function rebuildDefinedTerms(sql: Sql, corpusId: number, titles?: number[]) {
  // level_path is a text column ('t18.ptI.ch1.s20' — NOT ltree in the applied
  // migration; only an expression index casts it). Prefix-match it as text.
  const titleFilter = (column: string) =>
    titles?.length
      ? sql.unsafe(
          `and (${titles.map((t) => `${column} = 't${Number(t)}' or ${column} like 't${Number(t)}.%'`).join(' or ')})`,
        )
      : sql.unsafe('');

  const ancestorRows = await sql<AncestorRow[]>`
    select id, level_path::text, node_type from law_nodes
    where corpus_id = ${corpusId} and node_type <> 'section' and level_path is not null
    ${titleFilter('level_path')}
  `;
  const ancestors = new Map(ancestorRows.map((row) => [row.level_path, row]));

  await sql`
    delete from defined_terms using law_nodes n
    where defined_terms.node_id = n.id and defined_terms.corpus_id = ${corpusId}
    ${titleFilter('n.level_path')}
  `;

  let sections = 0;
  let inserted = 0;
  const pending: { corpus_id: number; node_id: number; scope_node_id: number; term: string; definition_text: string }[] = [];
  const flush = async () => {
    if (pending.length === 0) return;
    await sql`insert into defined_terms ${sql(pending)} on conflict do nothing`;
    inserted += pending.length;
    pending.length = 0;
  };

  const cursor = sql<SectionRow[]>`
    select id, level_path::text, body_text from law_nodes
    where corpus_id = ${corpusId} and node_type = 'section' and status = 'active'
      and body_text like '%term “%'
    ${titleFilter('level_path')}
  `.cursor(200);

  for await (const rows of cursor) {
    for (const row of rows) {
      const extracted = extractDefinedTerms(row.body_text);
      if (extracted.length === 0) continue;
      sections++;
      for (const def of extracted) {
        pending.push({
          corpus_id: corpusId,
          node_id: row.id,
          scope_node_id: resolveScopeNode(row.id, row.level_path, def.scope, ancestors),
          term: def.term,
          definition_text: def.definition,
        });
      }
    }
    if (pending.length >= 500) await flush();
  }
  await flush();
  return { sections, inserted };
}
