import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rPostUrl } from "@/lib/reddit-data";
import { DOCKET_DESIGN } from "./design";
import { DocketTrial } from "./docket-trial";
import { getDocket } from "./pick";

export const metadata: Metadata = {
  title: "Today’s trial — one law, everyone, same day",
  description: "Every day one law stands trial: read it, enter your verdict, make your case. A new trial opens at midnight UTC.",
};
export const dynamic = "force-dynamic";

export default async function DocketPage() {
  const docket = await getDocket();
  if (!docket) return <main style={{ padding: 24, font: "13px Verdana, sans-serif" }}>No cases on the docket yet.</main>;

  // "classic": today's trial IS a normal law post — everyone gets the same
  // random-for-the-day law, presented exactly like any other, plus a banner.
  if (DOCKET_DESIGN === "classic") redirect(`${rPostUrl(docket.law)}?trial=${docket.trialNumber}`);

  return <DocketTrial docket={docket} />;
}
