import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { after, connection } from "next/server";
import { DocketTrial } from "./docket-trial";
import { getDocket, rolloverStaleTags } from "./pick";

export const metadata: Metadata = {
  title: "Today’s trial — one section, everyone, same day",
  description: "Every day one section stands trial: read it, enter your verdict, make your case. A new trial opens at midnight Pacific.",
};

export default async function DocketPage() {
  // Rendered per request (the trial changes at midnight Pacific), but the data
  // comes from a per-day cache entry, so only the day's first view queries.
  await connection();
  const docket = await getDocket();
  if (!docket) return <main style={{ padding: 24, font: "13px Verdana, sans-serif" }}>No trials on the docket yet.</main>;
  const stale = rolloverStaleTags(docket);
  if (stale.length > 0) after(() => { for (const tag of stale) revalidateTag(tag, "max"); });
  return <DocketTrial docket={docket} />;
}
