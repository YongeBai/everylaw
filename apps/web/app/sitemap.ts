import type { MetadataRoute } from "next";
import { getFeatured, lawUrl } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"; const laws = await getFeatured(50000);
  return [{ url: base, changeFrequency: "daily", priority: 1 }, { url: `${base}/r`, changeFrequency: "weekly", priority: .8 }, { url: `${base}/docket`, changeFrequency: "daily", priority: .8 }, ...laws.filter((law) => law.featuredTier > 0).map((law) => ({ url: `${base}${lawUrl(law)}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: law.featuredTier === 2 ? .9 : .7 }))];
}
