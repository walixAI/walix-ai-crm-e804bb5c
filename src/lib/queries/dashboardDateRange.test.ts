import { createElement } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ filters: [] as unknown[][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const q: any = {};
  for (const method of ["select", "eq", "gte", "lte", "order", "range"]) q[method] = (...args: unknown[]) => {
    if (["gte", "lte"].includes(method)) state.filters.push([table, method, ...args]);
    return q;
  };
  q.then = (resolve: any) => resolve({ error: null, data: table === "pipeline_stages" ? [{ id: "stage", name: "Venta", position: 1 }] : [
    { amount: 123, stage_id: "stage", is_won: true, is_lost: false, won_at: "2026-11-24T05:59:59.999Z", updated_at: "2026-11-24T05:59:59.999Z" },
    { amount: 456, stage_id: "stage", is_won: true, is_lost: false, won_at: "2026-11-24T06:00:00.000Z", updated_at: "2026-11-24T06:00:00.000Z" },
  ] });
  return q;
} } }));
import { useDealsClosedTimeline, usePipelineByStage } from "./dashboard";
afterEach(cleanup);

function harness() {
  state.filters = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

it("the stage chart queries complete November 1–23 days", async () => {
  const { client, wrapper } = harness();
  const { result } = renderHook(() => usePipelineByStage("all", 23, "2026-11-01", "2026-11-23"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(state.filters).toContainEqual(["deals", "gte", "updated_at", "2026-11-01T06:00:00.000Z"]);
  expect(state.filters).toContainEqual(["deals", "lte", "updated_at", "2026-11-24T05:59:59.999Z"]);
  client.clear();
});

it("the closed sales chart includes the last millisecond of November 23 in that day's bucket only", async () => {
  const { client, wrapper } = harness();
  const { result } = renderHook(() => useDealsClosedTimeline(23, "all", "2026-11-01", "2026-11-23"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(23);
  expect(result.current.data?.at(-1)).toMatchObject({ date: "2026-11-23", value: 123 });
  expect(result.current.data?.reduce((sum, row) => sum + row.value, 0)).toBe(123);
  client.clear();
});