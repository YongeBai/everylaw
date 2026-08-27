export type HistoryEntry = { kind: "enacted" | "amended"; act: string; date: string | null; year: number | null; statAtLarge: string | null };

const DATE_RE = /(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)[a-z.]*\s+\d{1,2},\s+(\d{4})/;

/**
 * Parse a USC source credit into a structured enactment/amendment timeline.
 * Credits look like: "(June 25, 1948, ch. 645, 62 Stat. 756; Pub. L. 103–322,
 * title VI, § 60003(a)(4), Sept. 13, 1994, 108 Stat. 1969.)"
 * Best-effort and purely lexical — segments that don't parse are skipped.
 */
export function parseHistory(sourceCredit: string | null): HistoryEntry[] {
  if (!sourceCredit) return [];
  const trimmed = sourceCredit.trim().replace(/^\(/, "").replace(/\.?\)$/, "");
  const segments = trimmed.split(/;\s*/);
  const entries: HistoryEntry[] = [];
  for (const segment of segments) {
    const normalized = segment.replace(/[–—]/g, "-");
    const pl = normalized.match(/Pub\.\s*L\.\s*\d+-\d+/)?.[0]?.replace(/\s+/g, " ") ?? null;
    const chapter = normalized.match(/ch\.\s*\d+/)?.[0] ?? null;
    const act = pl ?? (chapter ? `Act of ${normalized.match(DATE_RE)?.[0] ?? "unknown date"}, ${chapter}` : null);
    if (!act) continue;
    const dateMatch = normalized.match(DATE_RE);
    const statute = normalized.match(/\d+\s+Stat\.\s+[\d, ]*\d/)?.[0]?.replace(/\s+/g, " ") ?? null;
    entries.push({
      kind: entries.length === 0 ? "enacted" : "amended",
      act,
      date: dateMatch?.[0] ?? null,
      year: dateMatch ? Number(dateMatch[2]) : null,
      statAtLarge: statute,
    });
  }
  return entries;
}
