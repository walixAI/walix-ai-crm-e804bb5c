import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, any>[]>,
  voice: { call: null as any, state: "idle", error: "" },
  reads: [] as string[],
}));
vi.mock("@/store/auth", () => ({ useAuthStore: (selector: any) => selector({ user: { id: "advisor" }, activeTenantId: "tenant" }) }));
vi.mock("./useIncomingBrowserCall", () => ({ useIncomingBrowserCall: () => mocks.voice }));
vi.mock("./incoming-call-audio", () => ({ playIncomingAlert: vi.fn(() => ({ stop: vi.fn() })), unlockIncomingAudio: vi.fn(async () => false) }));
vi.mock("./CallAudioControls", () => ({ CallAudioControls: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const filters: ((row: Record<string, any>) => boolean)[] = [];
    let update: Record<string, any> | undefined;
    let limit = Infinity;
    const field = (row: Record<string, any>, key: string) => key === "data->>call_id" ? row.data.call_id : row[key];
    const result = () => {
      const rows = (mocks.rows[table] ?? []).filter(row => filters.every(filter => filter(row)))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
      if (update) rows.forEach(row => { Object.assign(row, update); mocks.reads.push(row.id); });
      return { data: rows, error: null };
    };
    const builder: any = {
      select: () => builder,
      update: (value: Record<string, any>) => { update = value; return builder; },
      eq: (key: string, value: unknown) => { filters.push(row => field(row, key) === value); return builder; },
      is: (key: string, value: unknown) => { filters.push(row => field(row, key) === value); return builder; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(field(row, key))); return builder; },
      gte: (key: string, value: string) => { filters.push(row => field(row, key) >= value); return builder; },
      order: () => builder,
      limit: (value: number) => { limit = value; return builder; },
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  },
  channel: () => { const channel: any = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));

import { IncomingCallPopup } from "./IncomingCallPopup";

const now = new Date().toISOString();
const old = new Date(Date.now() - 180000).toISOString();
function call(id = "call", status = "ringing", started_at = now) {
  return { id, status, started_at, answered_at: null, tenant_id: "tenant", direction: "inbound" };
}
function alert(id = "incoming", call_id = "call", type = "inbound_call", created_at = now) {
  return { id, type, created_at, tenant_id: "tenant", user_id: "advisor", read_at: null, title: "Llamada entrante: Prueba", body: "Número: +525555555555", data: { call_id } };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><MemoryRouter><IncomingCallPopup /></MemoryRouter></QueryClientProvider>);
  return { client, ...view };
}
async function settled(client: QueryClient) {
  await waitFor(() => expect(client.getQueryState(["incoming-call", "tenant", "advisor"])?.status).toBe("success"));
}
beforeEach(() => { mocks.rows = { calls: [call()], notifications: [alert()] }; mocks.reads = []; mocks.voice = { call: null, state: "idle", error: "" }; });
afterEach(cleanup);

describe("avisos de llamadas activas", () => {
  it("no abre llamadas antiguas aunque sigan marcadas ringing", async () => {
    mocks.rows = { calls: [call("call", "ringing", old)], notifications: [alert("incoming", "call", "inbound_call", old)] };
    const { client } = mount(); await settled(client);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.rows.notifications[0].read_at).toBeNull();
  });
  it("no abre llamadas terminadas aunque su aviso sea reciente", async () => {
    mocks.rows.calls = [call("call", "completed")];
    const { client } = mount(); await settled(client);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("deja avisos no atendidos en la campana sin abrir ventanas", async () => {
    mocks.rows.notifications = [alert("missed", "call", "missed_inbound_call")];
    const { client } = mount(); await settled(client);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.rows.notifications[0].read_at).toBeNull();
  });
  it("abre una llamada activa aunque haya un aviso más reciente de otra terminada", async () => {
    mocks.rows.calls.push(call("ended", "no_answer"));
    mocks.rows.notifications.push(alert("ended-notice", "ended", "inbound_call", new Date(Date.now() + 1000).toISOString()));
    const { client } = mount(); await settled(client);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.reads).toEqual(["incoming"]);
  });
  it("cerrar reconoce ambos avisos de la misma llamada sin tocar otros", async () => {
    mocks.rows.notifications.push(alert("missed", "call", "missed_inbound_call"), alert("other", "other", "missed_inbound_call"));
    const { client } = mount(); await settled(client);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.reads.sort()).toEqual(["incoming", "missed"]);
    expect(mocks.rows.notifications.find(row => row.id === "other")?.read_at).toBeNull();
  });
  it("retira el modal cuando la llamada termina al refrescar", async () => {
    const { client } = mount(); await settled(client);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    mocks.rows.calls[0].status = "completed";
    await act(async () => { await client.invalidateQueries({ queryKey: ["incoming-call"] }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("conserva la conversación del navegador aunque no haya aviso pendiente", async () => {
    mocks.rows.calls = []; mocks.rows.notifications = [];
    mocks.voice = { call: { customParameters: new Map([["WalixCallId", "call"]]) }, state: "connected", error: "" };
    const { client } = mount(); await settled(client);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});