import { describe, expect, it } from "vitest";
import { contentHash } from "../src/load.ts";
import type { ParsedNode } from "../src/parse.ts";

const node: ParsedNode = {
  identifier: "/us/usc/t18/s1",
  parentIdentifier: "/us/usc/t18/ch1",
  nodeType: "section",
  levelPath: "t18.ch1.s1",
  sortKey: "000001",
  citation: "18 U.S.C. § 1",
  num: "1",
  heading: "Example",
  status: "active",
  bodyHtml: "<p>Example text.</p>",
  bodyText: "Example text.",
  sourceCredit: null,
  enactingPl: null,
  enactedDate: null,
  amendmentCount: 0,
  wordCount: 2,
};

describe("contentHash", () => {
  it("changes when parser-derived placement or counts change", () => {
    const baseline = contentHash(node);
    expect(contentHash({ ...node, levelPath: "t18.ch2.s1" })).not.toBe(baseline);
    expect(contentHash({ ...node, sortKey: "000002" })).not.toBe(baseline);
    expect(contentHash({ ...node, wordCount: 3 })).not.toBe(baseline);
  });
});
