import { describe, expect, it } from "vitest";
import { lawNodes, votes, takes } from "./schema.js";

describe("database schema", () => {
  it("keeps account-ready anonymous vote fields", () => {
    expect(votes.voterHash).toBeDefined();
    expect(votes.userId).toBeDefined();
  });
  it("models law hierarchy and voter-linked takes", () => {
    expect(lawNodes.parentId).toBeDefined();
    expect(takes.voterHash).toBeDefined();
    expect((takes as unknown as Record<string, unknown>).stance).toBeUndefined();
  });
});
