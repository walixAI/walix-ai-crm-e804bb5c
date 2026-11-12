import { expect, it } from "vitest";
import { dashboardMetrics } from "./dashboardMetrics";
it("calculates 50 percent current close rate versus 100 percent previous, not constants", () => {
  const base = { amount: 300, is_won: false, is_lost: false, won_at: null, lost_at: null };
  const metrics = dashboardMetrics([base, { ...base, is_won: true, won_at: "2026-11-02T12:00:00Z" }, { ...base, is_lost: true, lost_at: "2026-11-03T12:00:00Z" }, { ...base, is_won: true, won_at: "2026-10-03T12:00:00Z" }], new Date(2026, 10, 12));
  expect(metrics).toEqual({ pipelineValue: 300, pipelineDeltaPct: null, closeRate: 50, closeRateDelta: -50 });
});
it("leaves comparison unavailable without historical data", () => {
  expect(dashboardMetrics([], new Date(2026, 10, 12)).closeRateDelta).toBeNull();
});