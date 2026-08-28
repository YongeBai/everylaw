import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getLaw } from "@/lib/data";
import { lawUrl } from "@/lib/reddit-format";

type Props = { params: Promise<{ title: string; section: string }> };

/** Resolve generated citations without ever dropping a reader on an empty law page. */
export default async function CitationResolver({ params }: Props) {
  const { title, section } = await params;
  const titleNumber = Number(title);
  if (!Number.isInteger(titleNumber) || titleNumber < 1 || titleNumber > 54 || !/^[0-9][0-9A-Za-z.-]*$/.test(section)) notFound();

  const law = await getLaw(`title-${titleNumber}`, decodeURIComponent(section));
  if (law) permanentRedirect(lawUrl(law));
  redirect(`/search?q=${encodeURIComponent(`${titleNumber} U.S.C. § ${section}`)}`);
}
