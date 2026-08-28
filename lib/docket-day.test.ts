import { describe, expect, it } from "vitest";
import { docketDayKey } from "./docket-day";

describe("docketDayKey", () => {
  it("uses Pacific dates", () => {
    expect(docketDayKey(new Date("2026-01-01T07:30:00Z"))).toBe("2025-12-31");
  });

  it("moves by calendar days across daylight-saving changes", () => {
    expect(docketDayKey(new Date("2026-03-09T07:30:00Z"), -1)).toBe("2026-03-08");
    expect(docketDayKey(new Date("2026-11-02T08:30:00Z"), -1)).toBe("2026-11-01");
  });
});
