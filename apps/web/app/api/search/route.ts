import { NextRequest, NextResponse } from "next/server";
import { lawUrl, searchLaws } from "@/lib/data";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.slice(0, 100) || "";
  const laws = await searchLaws(query, 8);
  return NextResponse.json({ results: laws.map((law) => ({ citation: law.citation, heading: law.heading, url: lawUrl(law) })) });
}
