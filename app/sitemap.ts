import type { MetadataRoute } from "next";
import { getFeatured } from "@/lib/data";
import { lawUrl } from "@/lib/reddit-format";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"; const laws = await getFeatured(50000);
  const now = new Date();
  return [{ url: base, changeFrequency: "daily", priority: 1 }, { url: `${base}/r`, changeFrequency: "weekly", priority: .8 }, { url: `${base}/docket`, changeFrequency: "daily", priority: .8 }, ...laws.map((law) => ({ url: `${base}${lawUrl(law)}`, lastModified: now, changeFrequency: "weekly" as const, priority: .7 }))];
}
