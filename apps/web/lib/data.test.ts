import { describe, expect, it } from "vitest";
import { lawUrl } from "./data";

describe("citation URLs", () => {
  it("uses stable title and section paths", () => {
    expect(lawUrl({ title: 18, num: "1111", identifier: "/us/usc/t18/s1111" })).toBe("/us/title-18/1111");
    expect(lawUrl({ title: 26, num: "5000A", identifier: "/us/usc/t26/s5000A" })).toBe("/us/title-26/5000A");
    expect(lawUrl({ title: 5, num: "5757", identifier: "/us/usc/t5/s5757~2" })).toBe("/us/title-5/5757~2");
  });
});
