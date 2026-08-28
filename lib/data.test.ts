import { describe, expect, it } from "vitest";
import { lawUrl, subredditUrl } from "./reddit-format";

describe("citation URLs", () => {
  it("uses canonical named title slugs and stable section paths", () => {
    expect(lawUrl({ title: 18, num: "1111", identifier: "/us/usc/t18/s1111" })).toBe("/r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE/1111");
    expect(lawUrl({ title: 26, num: "5000A", identifier: "/us/usc/t26/s5000A" })).toBe("/r/title-26-INTERNAL-REVENUE-CODE/5000A");
    expect(lawUrl({ title: 5, num: "5757", identifier: "/us/usc/t5/s5757~2" })).toBe("/r/title-5-GOVERNMENT-ORGANIZATION-AND-EMPLOYEES/5757~2");
    expect(subredditUrl(18)).toBe("/r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE");
  });
});
