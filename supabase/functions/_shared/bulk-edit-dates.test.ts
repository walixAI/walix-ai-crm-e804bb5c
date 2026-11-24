import { expect, it, vi } from "vitest";
import { applyFilters } from "./bulk-edit";

it.each(["activities", "tasks"] as const)("%s date filters include all of November 23 without writing records", entity => {
  const q = { gte: vi.fn(), lte: vi.fn() };
  q.gte.mockReturnValue(q); q.lte.mockReturnValue(q);
  applyFilters(q, entity, { date_from: "2026-11-01", date_to: "2026-11-23" });
  const column = entity === "activities" ? "occurred_at" : "due_at";
  expect(q.gte).toHaveBeenCalledWith(column, "2026-11-01T06:00:00.000Z");
  expect(q.lte).toHaveBeenCalledWith(column, "2026-11-24T05:59:59.999Z");
});

it("keeps opportunity DATE filters date-only", () => {
  const q = { gte: vi.fn(), lte: vi.fn() };
  q.gte.mockReturnValue(q); q.lte.mockReturnValue(q);
  applyFilters(q, "deals", { date_from: "2026-11-01", date_to: "2026-11-23" });
  expect(q.gte).toHaveBeenCalledWith("expected_close_date", "2026-11-01");
  expect(q.lte).toHaveBeenCalledWith("expected_close_date", "2026-11-23");
});