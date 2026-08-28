import type { Metadata } from "next";
import { DocketTrial } from "./docket-trial";
import { getDocket } from "./pick";

export const metadata: Metadata = {
  title: "Today’s trial — one section, everyone, same day",
  description: "Every day one section stands trial: read it, enter your verdict, make your case. A new trial opens at midnight UTC.",
};
export const dynamic = "force-dynamic";

export default async function DocketPage() {
  const docket = await getDocket();
  if (!docket) return <main style={{ padding: 24, font: "13px Verdana, sans-serif" }}>No cases on the docket yet.</main>;
  return <DocketTrial docket={docket} />;
}
