import { describe, expect, it } from "vitest";
import { extractDefinedTerms } from "../src/definitions.ts";

const S27 =
  "In this title, the term “mortgage lending business” means an organization which finances or refinances any debt secured by an interest in real estate, including private mortgage companies and any subsidiaries of such organizations, and whose activities affect interstate or foreign commerce.";

const S20 =
  "As used in this title, the term “financial institution” means— (1) an insured depository institution (as defined in section 3(c)(2) of the Federal Deposit Insurance Act); (2) a credit union with accounts insured by the National Credit Union Share Insurance Fund; (10) a mortgage lending business (as defined in section 27 of this title ) or any person or entity that makes in whole or in part a federally related mortgage loan as defined in section 3 of the Real Estate Settlement Procedures Act of 1974.";

describe("extractDefinedTerms", () => {
  it("extracts a title-scoped single-sentence definition (18 USC 27)", () => {
    expect(extractDefinedTerms(S27)).toEqual([
      { term: "mortgage lending business", scope: "title", definition: expect.stringContaining("finances or refinances any debt secured by an interest in real estate") },
    ]);
  });

  it("is not fooled by cross-reference phrasing like 'section 27 of this title' (18 USC 20)", () => {
    const [def] = extractDefinedTerms(S20);
    expect(def.term).toBe("financial institution");
    expect(def.scope).toBe("title");
    expect(extractDefinedTerms(S20)).toHaveLength(1);
  });

  it("scopes enumerated definitions to the nearest preceding scope phrase", () => {
    const text =
      "As used in this chapter— (1) the term “aircraft” means a civil, military, or public contrivance used for flight; (2) the term “motor vehicle” includes every vehicle designed for running on land;";
    expect(extractDefinedTerms(text)).toEqual([
      { term: "aircraft", scope: "chapter", definition: "the term “aircraft” means a civil, military, or public contrivance used for flight;" },
      { term: "motor vehicle", scope: "chapter", definition: "the term “motor vehicle” includes every vehicle designed for running on land;" },
    ]);
  });

  it("handles multi-term lists and the em-dash list form", () => {
    const text =
      "For purposes of this section, the terms “blackmail” and “extortion” have the meanings given those terms in chapter 41. The term “official act”— (A) means any decision or action on a question or matter;";
    const defs = extractDefinedTerms(text);
    expect(defs.map((d) => d.term)).toEqual(["blackmail", "extortion", "official act"]);
    expect(defs[0].scope).toBe("section");
    expect(defs[2].definition).toContain("any decision or action");
  });

  it("treats subsection and paragraph scopes as section scope", () => {
    const text = "As used in this subsection, the term “serious bodily injury” means bodily injury which involves a substantial risk of death.";
    expect(extractDefinedTerms(text)[0].scope).toBe("section");
  });

  it("ignores mere mentions without a defining verb", () => {
    const text = "Whoever misuses the term “federal agent” in any advertisement shall be fined under this title.";
    expect(extractDefinedTerms(text)).toEqual([]);
  });

  it("dedupes a term defined twice, keeping the first definition", () => {
    const text =
      "In this section, the term “program” means a plan of study. As used in this section, the term “Program” includes any successor plan.";
    const defs = extractDefinedTerms(text);
    expect(defs).toHaveLength(1);
    expect(defs[0].definition).toContain("plan of study");
  });

  it("caps runaway definitions at a readable excerpt", () => {
    const text = `In this chapter, the term “device” means ${"a very long enumeration of things; ".repeat(60)}`;
    const [def] = extractDefinedTerms(text);
    expect(def.definition.length).toBeLessThanOrEqual(720);
    expect(def.definition).toContain("…");
  });
});
