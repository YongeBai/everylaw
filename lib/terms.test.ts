import { describe, expect, it } from "vitest";
import { highlightTerms, markDefinedTerms } from "./terms";

describe("markDefinedTerms", () => {
  const terms = [{ id: 7, term: "mortgage lending business" }];

  it("stars the first occurrence only, case-insensitively", () => {
    const html = "<p>a Mortgage Lending Business… and again a mortgage lending business.</p>";
    const out = markDefinedTerms(html, terms);
    expect(out).toContain('<mark class="law-term law-term-defined" data-def="7" role="button" tabindex="0">Mortgage Lending Business<sup aria-hidden="true">*</sup></mark>');
    expect(out.match(/<mark/g)).toHaveLength(1);
  });

  it("never matches inside tag markup", () => {
    const html = '<p class="person">nobody here</p>';
    expect(markDefinedTerms(html, [{ id: 1, term: "person" }])).toBe(html);
  });

  it("respects word boundaries", () => {
    const html = "<p>repersonalization of persons and the person himself</p>";
    const out = markDefinedTerms(html, [{ id: 1, term: "person" }]);
    expect(out).toContain('data-def="1"');
    expect(out).toContain("repersonalization of persons and the <mark");
  });

  it("marks the longer term when terms nest, without nesting marks", () => {
    const html = "<p>a financial institution is an institution</p>";
    const out = markDefinedTerms(html, [
      { id: 1, term: "institution" },
      { id: 2, term: "financial institution" },
    ]);
    expect(out).toMatch(/data-def="2"[^>]*>financial institution</);
    // The shorter term matches the later, unmarked occurrence instead.
    expect(out).toMatch(/data-def="1"[^>]*>institution</);
    expect(out).not.toMatch(/<mark[^>]*><mark/);
  });

  it("layers curated highlighting after statutory marks without collisions", () => {
    const html = "<p>Whoever robs a financial institution shall be fined.</p>";
    const out = highlightTerms(markDefinedTerms(html, [{ id: 2, term: "financial institution" }]));
    expect(out).toContain('data-def="2"');
    expect(out).toContain('data-term="whoever"');
  });

  it("does not dot a curated term in its own defining section", () => {
    const html = "<p>A food shall be deemed to be misbranded when its labeling is false.</p>";
    const out = highlightTerms(html, { title: 21, section: "343" });
    expect(out).not.toContain('data-term="misbranded"');
  });

  it("does not dot terms already covered by statutory definitions", () => {
    const html = "<p>Interstate commerce appears more than once in interstate commerce.</p>";
    const out = highlightTerms(markDefinedTerms(html, [{ id: 4, term: "interstate commerce" }]), { excludeTerms: ["interstate commerce"] });
    expect(out).toContain('data-def="4"');
    expect(out).not.toContain('data-term="interstate commerce"');
  });
});
