/**
 * Editorial cold-start for the front page. These are real sections chosen to
 * invite an opinion quickly: pocketbook rules, civil rights, charged crimes,
 * internet/privacy questions, and a few federal-law oddities.
 *
 * This is not a permanent ranking. Sections with sustained weekly activity
 * outrank the list in getRPosts; the seeds only prevent an empty or arbitrary
 * U.S.-Code-order homepage while the community is young.
 */
export const HOME_SEEDS = [
  { identifier: "/us/usc/t26/s1", category: "pocketbook" },
  { identifier: "/us/usc/t18/s1111", category: "provocative" },
  { identifier: "/us/usc/t29/s206", category: "work" },
  { identifier: "/us/usc/t17/s107", category: "internet" },
  { identifier: "/us/usc/t8/s1325", category: "immigration" },
  { identifier: "/us/usc/t42/s1983", category: "rights" },
  { identifier: "/us/usc/t21/s347", category: "oddity" },
  { identifier: "/us/usc/t47/s230", category: "internet" },
  { identifier: "/us/usc/t21/s844", category: "personal" },
  { identifier: "/us/usc/t26/s61", category: "pocketbook" },
  { identifier: "/us/usc/t18/s700", category: "speech" },
  { identifier: "/us/usc/t29/s2612", category: "work" },
  { identifier: "/us/usc/t18/s1030", category: "internet" },
  { identifier: "/us/usc/t42/s2000a", category: "rights" },
  { identifier: "/us/usc/t26/s5000A", category: "health" },
  { identifier: "/us/usc/t18/s2384", category: "provocative" },
  { identifier: "/us/usc/t26/s280E", category: "pocketbook" },
  { identifier: "/us/usc/t47/s222", category: "privacy" },
  { identifier: "/us/usc/t18/s3591", category: "provocative" },
  { identifier: "/us/usc/t7/s13–1", category: "oddity" },
  { identifier: "/us/usc/t11/s523", category: "pocketbook" },
  { identifier: "/us/usc/t21/s25", category: "oddity" },
  { identifier: "/us/usc/t18/s1958", category: "provocative" },
  { identifier: "/us/usc/t20/s1232g", category: "privacy" },
  { identifier: "/us/usc/t18/s1716", category: "oddity" },
] as const;

export const HOME_SEED_IDENTIFIERS: readonly string[] = HOME_SEEDS.map((seed) => seed.identifier);

export function homeSeedRank(identifier: string): number | null {
  const index = HOME_SEED_IDENTIFIERS.indexOf(identifier);
  return index < 0 ? null : index + 1;
}
