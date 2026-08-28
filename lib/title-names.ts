/**
 * Display subreddit slugs carry the title's name, matching old Reddit's visible
 * community identity. Canonical paths use the stable title number alone.
 */
/** Header topbar picks: title number + hand-shortened label (not derivable from the heading). */
export const TOPBAR_TITLES: [number, string][] = [
  [18, "crimes"], [21, "food&drugs"], [26, "taxes"], [47, "telecom"], [15, "commerce"],
  [42, "health"], [16, "conservation"], [49, "transportation"], [7, "agriculture"], [38, "veterans"],
];

const TITLE_NAMES: Record<number, string> = {
  1: "GENERAL-PROVISIONS",
  2: "THE-CONGRESS",
  3: "THE-PRESIDENT",
  4: "FLAG-AND-SEAL-SEAT-OF-GOVERNMENT-AND-THE-STATES",
  5: "GOVERNMENT-ORGANIZATION-AND-EMPLOYEES",
  6: "DOMESTIC-SECURITY",
  7: "AGRICULTURE",
  8: "ALIENS-AND-NATIONALITY",
  9: "ARBITRATION",
  10: "ARMED-FORCES",
  11: "BANKRUPTCY",
  12: "BANKS-AND-BANKING",
  13: "CENSUS",
  14: "COAST-GUARD",
  15: "COMMERCE-AND-TRADE",
  16: "CONSERVATION",
  17: "COPYRIGHTS",
  18: "CRIMES-AND-CRIMINAL-PROCEDURE",
  19: "CUSTOMS-DUTIES",
  20: "EDUCATION",
  21: "FOOD-AND-DRUGS",
  22: "FOREIGN-RELATIONS-AND-INTERCOURSE",
  23: "HIGHWAYS",
  24: "HOSPITALS-AND-ASYLUMS",
  25: "INDIANS",
  26: "INTERNAL-REVENUE-CODE",
  27: "INTOXICATING-LIQUORS",
  28: "JUDICIARY-AND-JUDICIAL-PROCEDURE",
  29: "LABOR",
  30: "MINERAL-LANDS-AND-MINING",
  31: "MONEY-AND-FINANCE",
  32: "NATIONAL-GUARD",
  33: "NAVIGATION-AND-NAVIGABLE-WATERS",
  34: "CRIME-CONTROL-AND-LAW-ENFORCEMENT",
  35: "PATENTS",
  36: "PATRIOTIC-AND-NATIONAL-OBSERVANCES-CEREMONIES-AND-ORGANIZATIONS",
  37: "PAY-AND-ALLOWANCES-OF-THE-UNIFORMED-SERVICES",
  38: "VETERANS-BENEFITS",
  39: "POSTAL-SERVICE",
  40: "PUBLIC-BUILDINGS-PROPERTY-AND-WORKS",
  41: "PUBLIC-CONTRACTS",
  42: "THE-PUBLIC-HEALTH-AND-WELFARE",
  43: "PUBLIC-LANDS",
  44: "PUBLIC-PRINTING-AND-DOCUMENTS",
  45: "RAILROADS",
  46: "SHIPPING",
  47: "TELECOMMUNICATIONS",
  48: "TERRITORIES-AND-INSULAR-POSSESSIONS",
  49: "TRANSPORTATION",
  50: "WAR-AND-NATIONAL-DEFENSE",
  51: "NATIONAL-AND-COMMERCIAL-SPACE-PROGRAMS",
  52: "VOTING-AND-ELECTIONS",
  53: "RESERVED",
  54: "NATIONAL-PARK-SERVICE-AND-RELATED-PROGRAMS",
};

export function subredditSlug(title: number): string {
  const name = TITLE_NAMES[title];
  return name ? `title-${title}-${name}` : `title-${title}`;
}

/** Stable route slug; title names remain presentation rather than URL state. */
export function subredditPathSlug(title: number): string {
  return `title-${title}`;
}

/** Accepts canonical and legacy named title slugs. */
export function titleNumberFromSlug(slug: string): number | null {
  const match = /^title-(\d+)(?:-|$)/.exec(slug);
  return match ? Number(match[1]) : null;
}
