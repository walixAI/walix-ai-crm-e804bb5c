import { afterEach, expect, it, vi } from "vitest";
import { resolvePeriodRange } from "./reports";
import { useReportsData } from "./reports";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
const fetchState = vi.hoisted(() => ({ blocked: false }));
vi.mock("@/lib/queries/tenant", () => ({ useTenantId: () => ({ data: "tenant" }) }));
vi.mock("@/lib/queries/tenantUsers", () => ({ useTenantUsers: () => ({ data: [] }) }));
vi.mock("./paginate", () => ({ readAllPages: () => fetchState.blocked ? new Promise(() => {}) : Promise.resolve([]) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const chain: any = {};
  for (const method of ["select", "eq", "or", "gte", "lte", "order", "range"]) chain[method] = () => chain;
  chain.then = (resolve: any) => resolve({ data: [], error: null });
  return chain;
} } }));
afterEach(() => vi.useRealTimers());
it("includes November 1 through the entire November 23, 2026 in Mexico City time", () => {
  const range = resolvePeriodRange({ preset: "custom", from: "2026-11-01", to: "2026-11-23" });
  expect(range.from.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  expect(range.to.toISOString()).toBe("2026-11-24T05:59:59.999Z");
  const recordedStatus = Date.parse("2026-11-24T00:27:15.049Z");
  expect(recordedStatus).toBeGreaterThanOrEqual(range.from.getTime());
  expect(recordedStatus).toBeLessThanOrEqual(range.to.getTime());
});
it("includes a complete day when the start and end dates are the same", () => {
  const range = resolvePeriodRange({ preset: "custom", from: "2026-11-23", to: "2026-11-23" });
  expect(range.to.getTime() - range.from.getTime() + 1).toBe(86_400_000);
});
it("relative report boundaries advance instead of staying at the mount date", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T05:00:00Z"));
  const first = resolvePeriodRange({ preset: "today" });
  vi.setSystemTime(new Date("2026-11-12T05:01:00Z"));
  const next = resolvePeriodRange({ preset: "today" });
  expect(next.to.getTime() - first.to.getTime()).toBe(60_000);
  expect(next.from).toEqual(first.from);
});
it("keeps loaded report data while the minute refresh is pending", async () => {
  vi.useFakeTimers();
  fetchState.blocked = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const hook = renderHook(() => useReportsData({ period: { preset: "today" }, sellers: [] }), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(hook.result.current.data).not.toBeNull();
  const previous = hook.result.current.data;
  fetchState.blocked = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(client.getQueryCache().getAll()).toHaveLength(1);
  expect(client.getQueryCache().getAll()[0].state.fetchStatus).toBe("fetching");
  expect(hook.result.current.data).toBe(previous);
  expect(hook.result.current.isLoading).toBe(false);
  hook.unmount(); client.clear(); fetchState.blocked = false;
});