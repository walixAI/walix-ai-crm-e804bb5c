import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: Request) => Promise<Response>),
  trigger: "deal_inactive", fail: false,
  filters: [] as Array<[string, string, unknown]>,
  tasks: [] as any[],
}));
vi.mock("../_shared/request-security.ts", () => ({ requireInternalRequest: () => null }));
vi.mock("../_shared/transactional-email-templates/logged-send.ts", () => ({ sendAndLog: vi.fn() }));
vi.mock("npm:@supabase/supabase-js@2/cors", () => ({ corsHeaders: {} }));
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({
  rpc: async () => ({ data: [{ contact_id: "contact", last_inbound: "2020-01-01T00:00:00Z" }], error: null }),
  from: (table: string) => {
    const chain: any = {};
    for (const method of ["select", "is", "eq", "in", "lte", "order", "not", "gt", "neq", "lt", "or", "insert"]) {
      chain[method] = (...args: any[]) => {
        if (["eq", "lt", "in"].includes(method)) state.filters.push([table, args[0], args[1]]);
        if (table === "tasks" && method === "insert") state.tasks.push(args[0]);
        return chain;
      };
    }
    chain.then = (resolve: any) => resolve({
      data: table === "automations" ? [{ id: "auto", tenant_id: "tenant", trigger_type: state.trigger, actions: [{ type: "create_task" }] }]
        : ["deals", "contacts"].includes(table) ? [{ id: "contact", tenant_id: "tenant", owner_id: "owner" }] : [],
      error: table === "automations" && state.fail ? new Error("query failed") : null,
    });
    return chain;
  },
}) }));

beforeEach(async () => {
  state.filters = []; state.tasks = []; state.fail = false;
  vi.stubGlobal("Deno", { env: { get: () => "test" }, serve: (handler: typeof state.handler) => { state.handler = handler; } });
  await import("./index");
});

for (const trigger of ["deal_inactive", "deal_close_date_near", "contact_no_reply"]) {
  it(`runs enabled ${trigger} automations and returns defined counters`, async () => {
    state.trigger = trigger;
    if (!state.handler) throw new Error("No handler");
    const response = await state.handler(new Request("https://test.invalid", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, processed_subscriptions: 0, processed_automations: 1 });
    expect(state.filters).toContainEqual(["automations", "enabled", true]);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].tenant_id).toBe("tenant");
    if (trigger !== "contact_no_reply") {
      expect(state.filters).toContainEqual(["deals", "is_won", false]);
      expect(state.filters).toContainEqual(["deals", "is_lost", false]);
    }
  });
}
it("does not report success when loading automations fails", async () => {
  state.fail = true;
  if (!state.handler) throw new Error("No handler");
  const response = await state.handler(new Request("https://test.invalid", { method: "POST" }));
  expect(response.status).toBe(500);
  expect(state.tasks).toHaveLength(0);
});