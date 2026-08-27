/** Pure formatting helpers shared by server and client — no DB imports here. */

import { subredditSlug } from "@/lib/title-names";

export function rPostUrlFrom(title: number, num: string, identifier: string): string {
  const suffix = identifier.match(/(~\d+)$/)?.[1] ?? "";
  return `/r/${subredditSlug(title)}/${encodeURIComponent(`${num}${suffix}`)}`;
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
