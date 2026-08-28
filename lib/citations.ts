import { lawUrl } from "./reddit-format";

export type CitationPart = { text: string; href?: string };

// Full citations work without context. Bare "section 7" and "§ 7" references
// use the title of the law or prose they appear in.
const NUM = "([0-9][0-9A-Za-z]*(?:[.-][0-9A-Za-z]+)*(?:\\([0-9A-Za-z-]+\\))*)";
const SECTION_REFERENCE_RE = new RegExp(
  `\\b(\\d{1,2})\\s+U\\.S\\.C\\.\\s+§+\\s*${NUM}|(\\bsections?\\s+|§+\\s*)${NUM}\\s+of\\s+title\\s+(\\d{1,2})|(\\bsections?\\s+|§+\\s*)${NUM}`,
  "gi",
);

function sectionUrl(title: number, citedNum: string): string {
  const section = citedNum.split("(", 1)[0];
  return lawUrl({ title, num: section, identifier: "" });
}

/** Split prose into text and internal links for every recognizable U.S. Code section reference. */
export function sectionReferenceParts(text: string, defaultTitle?: number): CitationPart[] {
  const parts: CitationPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(SECTION_REFERENCE_RE)) {
    const at = match.index;
    if (at > cursor) parts.push({ text: text.slice(cursor, at) });
    const title = match[1] ? Number(match[1]) : match[5] ? Number(match[5]) : defaultTitle;
    const num = match[2] ?? match[4] ?? match[7];
    const matchedText = match[0];
    const describesAnotherAct = Boolean(match[7] && /^\s+of\s+(?:Public\s+Law|(?:an?|the)\s+Act)\b/i.test(text.slice(at + matchedText.length)));
    parts.push(title && num && !describesAnotherAct ? { text: matchedText, href: sectionUrl(title, num) } : { text: matchedText });
    cursor = at + matchedText.length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ text }];
}

/** Link references inside trusted statute HTML without touching its markup. */
export function linkSectionReferencesInHtml(html: string, defaultTitle: number): string {
  let anchorDepth = 0;
  return html.split(/(<[^>]*>)/).map((piece) => {
    if (piece.startsWith("<")) {
      if (/^<a[\s>]/i.test(piece)) anchorDepth++;
      else if (/^<\/a/i.test(piece)) anchorDepth = Math.max(0, anchorDepth - 1);
      return piece;
    }
    if (anchorDepth > 0 || piece === "") return piece;
    return sectionReferenceParts(piece, defaultTitle)
      .map((part) => part.href ? `<a href="${part.href}" class="law-section-ref">${part.text}</a>` : part.text)
      .join("");
  }).join("");
}
