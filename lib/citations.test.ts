import { describe, expect, it } from "vitest";
import { linkSectionReferencesInHtml, sectionReferenceParts } from "./citations";

describe("section references", () => {
  it("links a full U.S. Code citation to its canonical section", () => {
    expect(sectionReferenceParts("See 1 U.S.C. § 1."))
      .toContainEqual({ text: "1 U.S.C. § 1", href: "/r/title-1-GENERAL-PROVISIONS/1" });
  });

  it("links bare section references using the surrounding title", () => {
    expect(sectionReferenceParts("subject to section 3571 and § 3572", 18).filter((part) => part.href))
      .toEqual([
        { text: "section 3571", href: "/r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE/3571" },
        { text: "§ 3572", href: "/r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE/3572" },
      ]);
  });

  it("respects an explicit title and does not mislink sections of another act", () => {
    expect(sectionReferenceParts("section 1 of title 21", 18))
      .toContainEqual({ text: "section 1 of title 21", href: "/r/title-21-FOOD-AND-DRUGS/1" });
    expect(sectionReferenceParts("section 1 of Public Law 90-381", 18).some((part) => part.href)).toBe(false);
  });

  it("links text in statute HTML while preserving tags", () => {
    expect(linkSectionReferencesInHtml("<p>See section 7.</p>", 18))
      .toBe('<p>See <a href="/r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE/7" class="law-section-ref">section 7</a>.</p>');
  });
});
