import { describe, expect, it } from "vitest";
import { deterministicContent, lintContent } from "../src/content.js";

const law = { citation: "18 U.S.C. § 700", heading: "Flag desecration", bodyText: "Text", sourceCredit: "Pub. L. 90-381", enactingPl: "Pub. L. 90-381", enactedDate: "1968-07-05", wordCount: 100, amendmentCount: 1 };
describe("AI content safeguards", () => {
  it("hedges origin claims", () => expect(deterministicContent("origin", law)).toContain("does not establish Congress’s broader motive"));
  it("rejects AI self reference", () => expect(lintContent("summary", "As an AI, hello")).toContain("AI self-reference"));
  it("rejects overlong summaries", () => expect(lintContent("summary", "word ".repeat(71))).toContain("summary too long"));
  it("requires three to five fact bullets", () => expect(lintContent("facts", "- One\n- Two")).toContain("facts must contain 3–5 bullets"));
});
