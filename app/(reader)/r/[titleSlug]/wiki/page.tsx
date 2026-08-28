import { permanentRedirect } from "next/navigation";
import { subredditPathSlug, titleNumberFromSlug } from "@/lib/title-names";

type Props = { params: Promise<{ titleSlug: string }>; searchParams: Promise<{ page?: string }> };

/** Compatibility route for bookmarks created before wiki became a title tab. */
export default async function LegacyTitleWiki({ params, searchParams }: Props) {
  const { titleSlug } = await params;
  const { page } = await searchParams;
  const titleNum = titleNumberFromSlug(titleSlug);
  const canonical = titleNum ? subredditPathSlug(titleNum) : titleSlug;
  permanentRedirect(`/r/${canonical}?${new URLSearchParams({ view: "wiki", ...(page ? { page } : {}) })}`);
}
