import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { parseSourceCredit, parseUslmFile, type ParsedNode } from "../src/parse.ts";

describe("USLM streaming parser", () => {
  it("extracts source metadata", () => {
    expect(parseSourceCredit("Added Pub. L. 90–381, July 5, 1968; amended Pub. L. 101-131."))
      .toEqual({ enactingPl: "Pub. L. 90-381", enactedDate: "1968-07-05", amendmentCount: 2 });
  });

  it("keeps stubs and excludes notes", async () => {
    const fixture = fileURLToPath(new URL("fixtures/title-18-sample.xml", import.meta.url));
    const nodes: ParsedNode[] = [];
    await parseUslmFile(fixture, (node) => { nodes.push(node); });
    const chapter = nodes.find((node) => node.identifier.endsWith("ch51"))!;
    expect(chapter).toMatchObject({ num: "51", heading: "HOMICIDE", nodeType: "chapter" });
    const murder = nodes.find((node) => node.identifier.endsWith("s1111"))!;
    expect(murder.citation).toBe("18 U.S.C. § 1111");
    expect(murder.bodyText).toContain("unlawful killing");
    expect(murder.bodyText).not.toContain("editorial note");
    expect(murder.enactingPl).toBe("Pub. L. 103-322");
    expect(nodes.filter((node) => node.identifier.endsWith("s1111"))).toHaveLength(1);
    expect(nodes.find((node) => node.identifier.endsWith("s1112"))?.status).toBe("repealed");
    expect(nodes.find((node) => node.identifier.endsWith("s1201A"))).toMatchObject({ num: "1201A", status: "transferred" });
    expect(nodes.filter((node) => node.num === "130g").map((node) => node.identifier)).toEqual(["/us/usc/t18/s130g", "/us/usc/t18/s130g~2"]);
    expect(nodes.filter((node) => node.num === "119").map((node) => node.identifier)).toEqual(["/us/usc/t18/ch119", "/us/usc/t18/ch119~2"]);
    expect(nodes.find((node) => node.identifier.endsWith("ch119"))?.status).toBe("repealed");
    expect(nodes.find((node) => node.identifier.endsWith("s2510"))?.parentIdentifier).toBe("/us/usc/t18/ch119~2");
  });
});
