import { describe, expect, it } from "vitest";
import { optimisticTakeVoteCounts, optimisticVoteCounts } from "./vote-sync";

describe("optimisticVoteCounts", () => {
  it("adds a new vote immediately", () => {
    expect(optimisticVoteCounts({ keepCount: 3, dissolveCount: 2 }, null, "keep"))
      .toEqual({ keepCount: 4, dissolveCount: 2 });
  });

  it("moves a vote between sides", () => {
    expect(optimisticVoteCounts({ keepCount: 3, dissolveCount: 2 }, "keep", "dissolve"))
      .toEqual({ keepCount: 2, dissolveCount: 3 });
  });

  it("removes a vote without producing negative totals", () => {
    expect(optimisticVoteCounts({ keepCount: 3, dissolveCount: 2 }, "dissolve", null))
      .toEqual({ keepCount: 3, dissolveCount: 1 });
    expect(optimisticVoteCounts({ keepCount: 0, dissolveCount: 0 }, "keep", null))
      .toEqual({ keepCount: 0, dissolveCount: 0 });
  });
});

describe("optimisticTakeVoteCounts", () => {
  it("handles upvotes, switches, and unvotes", () => {
    expect(optimisticTakeVoteCounts({ upvoteCount: 2, downvoteCount: 1 }, null, 1))
      .toEqual({ upvoteCount: 3, downvoteCount: 1 });
    expect(optimisticTakeVoteCounts({ upvoteCount: 3, downvoteCount: 1 }, 1, -1))
      .toEqual({ upvoteCount: 2, downvoteCount: 2 });
    expect(optimisticTakeVoteCounts({ upvoteCount: 2, downvoteCount: 2 }, -1, null))
      .toEqual({ upvoteCount: 2, downvoteCount: 1 });
  });
});
