import { afterEach, expect, it, vi } from "vitest";
import { resolvePeriodRange } from "./reports";
afterEach(() => vi.useRealTimers());
it("relative report boundaries advance instead of staying at the mount date", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T05:00:00Z"));
  const first = resolvePeriodRange({ preset: "today" });
  vi.setSystemTime(new Date("2026-11-12T05:01:00Z"));
  const next = resolvePeriodRange({ preset: "today" });
  expect(next.to.getTime() - first.to.getTime()).toBe(60_000);
  expect(next.from).toEqual(first.from);
});