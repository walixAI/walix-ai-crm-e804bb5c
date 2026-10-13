import { describe, expect, it } from "vitest";
import { latestActiveOpportunity } from "./currentOpportunity";

describe("latestActiveOpportunity", () => {
  it("selects the newest open opportunity, not the most recently edited or closed one", () => {
    const deals = [
      { id: "older", createdAt: "2026-10-01", isWon: false, isLost: false },
      { id: "won", createdAt: "2026-10-13", isWon: true, isLost: false },
      { id: "current", createdAt: "2026-10-12", isWon: false, isLost: false },
      { id: "lost", createdAt: "2026-10-14", isWon: false, isLost: true },
    ];
    expect(latestActiveOpportunity(deals)?.id).toBe("current");
    expect(deals[0].id).toBe("older");
  });
  it("returns null with no open opportunities", () => {
    expect(latestActiveOpportunity([])).toBeNull();
    expect(latestActiveOpportunity([{ createdAt: "2026-10-12", isWon: true, isLost: false }])).toBeNull();
  });
});