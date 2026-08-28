import { describe, expect, it } from "vitest";
import { HOME_SEEDS, homeSeedRank } from "./home-seeds";

describe("homepage editorial seeds", () => {
  it("fills one page without duplicate sections", () => {
    expect(HOME_SEEDS).toHaveLength(25);
    expect(new Set(HOME_SEEDS.map((seed) => seed.identifier)).size).toBe(25);
  });

  it("mixes sensitive, provocative, practical, and odd laws", () => {
    const categories = new Set(HOME_SEEDS.map((seed) => seed.category));
    for (const category of ["pocketbook", "provocative", "rights", "internet", "oddity"]) {
      expect(categories).toContain(category);
    }
  });

  it("keeps an explicit stable fallback order", () => {
    expect(homeSeedRank("/us/usc/t26/s1")).toBe(1);
    expect(homeSeedRank("/us/usc/t18/s1716")).toBe(25);
    expect(homeSeedRank("/us/usc/t1/s1")).toBeNull();
  });

  it("disperses neighboring seeds by both subject and U.S. Code title", () => {
    for (let index = 1; index < HOME_SEEDS.length; index += 1) {
      const previous = HOME_SEEDS[index - 1]!;
      const current = HOME_SEEDS[index]!;
      expect(current.category).not.toBe(previous.category);
      expect(current.identifier.match(/\/t\d+/)?.[0]).not.toBe(previous.identifier.match(/\/t\d+/)?.[0]);
    }
  });
});
