/** Pure formatting helpers shared by server and client — no DB imports here. */

import { subredditPathSlug } from "./title-names";

/** Title number from a USLM identifier like '/us/usc/t18/s1111'. */
export function titleFromIdentifier(identifier: string): number {
  return Number(identifier.match(/\/t(\d+)/)?.[1] ?? 0);
}

/** Split a section URL param like '1111' or '130g~2' into num + variant suffix. */
export function parseSectionParam(section: string): { num: string; suffix: string } {
  const variant = section.match(/^(.*)~(\d+)$/);
  return variant ? { num: variant[1], suffix: `~${variant[2]}` } : { num: section, suffix: "" };
}

/** Canonical URL of a law's page. The single link builder for the whole app. */
export function lawUrl(law: { title: number; num: string; identifier: string }): string {
  const suffix = law.identifier.match(/(~\d+)$/)?.[1] ?? "";
  return `/r/${subredditPathSlug(law.title)}/${encodeURIComponent(`${law.num}${suffix}`)}`;
}

/** Canonical URL of a title's subreddit page. */
export function subredditUrl(title: number): string {
  return `/r/${subredditPathSlug(title)}`;
}

/** Canonical URL of a title's wiki tab — the index of its statutory defined terms. */
export function wikiUrl(title: number): string {
  return `/r/${subredditPathSlug(title)}?view=wiki`;
}

export function officialSourceUrl(title: number, num: string): string {
  return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${title}-section${encodeURIComponent(num)}&num=0&edition=prelim`;
}

export function agePhrase(enactedDate: string | null): string {
  if (!enactedDate) return "date unrecorded";
  const year = Number(enactedDate.match(/\d{4}/)?.[0]);
  if (!year) return "date unrecorded";
  const age = new Date().getFullYear() - year;
  return age <= 0 ? "this year" : `${age} year${age === 1 ? "" : "s"} ago`;
}
