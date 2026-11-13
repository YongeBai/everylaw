import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getLawCached } from "@/lib/cached";
import { lawUrl } from "@/lib/reddit-format";

type Props = { params: Promise<{ title: string; section: string }> };

// Deliberately not statically generated: this route only ever redirects, and
// the lookup behind it is cached (lib/cached.ts), so a resolved citation costs
// no database query either way.

/** Resolve generated citations without ever dropping a reader on an empty law page. */
export default async function CitationResolver({ params }: Props) {
  const { title, section } = await params;
  const titleNumber = Number(title);
  if (!Number.isInteger(titleNumber) || titleNumber < 1 || titleNumber > 54 || !/^[0-9][0-9A-Za-z.-]*$/.test(section)) notFound();

  const law = await getLawCached(titleNumber, decodeURIComponent(section));
  if (law) permanentRedirect(lawUrl(law));
  redirect(`/search?q=${encodeURIComponent(`${titleNumber} U.S.C. § ${section}`)}`);
}
