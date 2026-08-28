import { ImageResponse } from "next/og";
import { getLawLiteById } from "@/lib/data";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const law = await getLawLiteById(Number((await params).nodeId));
  if (!law) return new Response("Not found", { status: 404 });
  const dissolve = Math.round(law.dissolveRatio * 100);
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#f5f0e6", color: "#13241d", padding: 70, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 800 }}><span>EveryLaw.</span><span>{law.citation}</span></div>
    <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05, display: "flex" }}>{law.heading}</div><div style={{ fontSize: 30, marginTop: 24, display: "flex" }}>Should this law survive?</div></div>
    <div style={{ display: "flex", flexDirection: "column" }}><div style={{ width: "100%", height: 38, background: "#236348", borderRadius: 20, overflow: "hidden", display: "flex" }}><div style={{ width: `${dissolve}%`, height: "100%", background: "#b93b2f" }} /></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 25, marginTop: 14 }}><span>{100 - dissolve}% keep</span><span>{dissolve}% dissolve</span></div></div>
  </div>, { width: 1200, height: 630 });
}
