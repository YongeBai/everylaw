import type { Block, Inline, ListItem } from "@/lib/markdown";
import { TERM_DEFINITIONS } from "@/lib/terms";

/**
 * Term annotation for translation bodies: the plain-English counterpart of
 * lib/terms.ts, operating on the markdown AST instead of an HTML string.
 * Marks the first occurrence of each statutory defined term (starred card)
 * and curated term of art (dotted note) inside a body's text runs, so the
 * same definition cards the official pane shows work in the translation.
 */

export type TermInline = Inline | { kind: "defterm"; id: number; text: string } | { kind: "artterm"; term: string; text: string };

type Entry = { term: string; make: (text: string) => TermInline };
type Context = { title?: number; section?: string; excludeTerms?: Iterable<string> };

const isWordChar = (ch: string | undefined) => ch !== undefined && /[\w’']/.test(ch);

/** Find a whole-word, case-insensitive match of `needle` in `text`, or -1. */
function wordIndexOf(text: string, needle: string): number {
  const lower = text.toLowerCase();
  let at = lower.indexOf(needle);
  while (at !== -1 && (isWordChar(text[at - 1]) || isWordChar(text[at + needle.length]))) {
    at = lower.indexOf(needle, at + 1);
  }
  return at;
}

/** Every inline list in the document a term may be marked inside. */
function inlineSlots(blocks: Block[]): Inline[][] {
  const slots: Inline[][] = [];
  const fromItems = (items: ListItem[]) => items.forEach((item) => { slots.push(item.inline); walk(item.children); });
  const walk = (list: Block[]) => {
    for (const block of list) {
      switch (block.kind) {
        case "paragraph": case "quote": slots.push(block.inline); break;
        case "list": fromItems(block.items); break;
        case "callout": walk(block.children); break;
        case "toggle": slots.push(block.summary); walk(block.children); break;
        case "columns": block.columns.forEach(walk); break;
        case "table": block.rows.forEach((row) => row.forEach((cell) => slots.push(cell)));
      }
    }
  };
  walk(blocks);
  return slots;
}

/** Mark one entry's first occurrence across the document; true if found. */
function markFirst(slots: Inline[][], entry: Entry): boolean {
  const needle = entry.term.toLowerCase();
  for (const inline of slots) {
    for (let i = 0; i < inline.length; i++) {
      const node = inline[i];
      // Only bare text is eligible — never code, and never inside an
      // emphasis span (the statute-term italics read as already-annotated).
      if (node.kind !== "text") continue;
      const at = wordIndexOf(node.text, needle);
      if (at === -1) continue;
      const matched = node.text.slice(at, at + needle.length);
      const parts: Inline[] = [];
      if (at > 0) parts.push({ kind: "text", text: node.text.slice(0, at) });
      parts.push(entry.make(matched) as Inline);
      if (at + needle.length < node.text.length) parts.push({ kind: "text", text: node.text.slice(at + needle.length) });
      inline.splice(i, 1, ...parts);
      return true;
    }
  }
  return false;
}

/**
 * Annotate a parsed translation body in place. Longest terms win overlaps
 * (marked first, and a marked run is no longer bare text). Returns the ids
 * of the statutory terms that actually got marked, so the page only ships
 * card data for terms a reader can open.
 */
export function annotateTerms(blocks: Block[], statutoryTerms: { id: number; term: string }[], context: Context = {}): { blocks: Block[]; markedIds: Set<number> } {
  const slots = inlineSlots(blocks);
  const excluded = new Set(Array.from(context.excludeTerms ?? [], (term) => term.toLowerCase()));
  const markedIds = new Set<number>();
  const entries: Entry[] = [
    ...statutoryTerms.map(({ id, term }): Entry => ({ term, make: (text) => (markedIds.add(id), { kind: "defterm", id, text }) })),
    ...TERM_DEFINITIONS
      .filter(({ term, definedAt }) => !excluded.has(term.toLowerCase())
        && !definedAt?.some((location) => location.title === context.title && location.section.toLowerCase() === context.section?.toLowerCase()))
      .map(({ term }): Entry => ({ term, make: (text) => ({ kind: "artterm", term, text }) })),
  ].sort((a, b) => b.term.length - a.term.length);
  for (const entry of entries) markFirst(slots, entry);
  return { blocks, markedIds };
}
