import { describe, expect, it } from "vitest";
import { lawNodes, votes, takes } from "./schema.js";

describe("database schema", () => {
  it("keeps anonymous vote identity fields", () => {
    expect(votes.voterHash).toBeDefined();
    // Accounts scaffolding (users, votes.user_id) was dropped in 0009 as unused.
    expect((votes as unknown as Record<string, unknown>).userId).toBeUndefined();
  });
  it("models law hierarchy and voter-linked takes", () => {
    expect(lawNodes.parentId).toBeDefined();
    expect(takes.voterHash).toBeDefined();
    expect((takes as unknown as Record<string, unknown>).stance).toBeUndefined();
  });
});
