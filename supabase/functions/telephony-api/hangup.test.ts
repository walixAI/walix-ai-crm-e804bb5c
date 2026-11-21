import { readFileSync } from "node:fs";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
let call: Record<string, unknown>;
let writes: Record<string, unknown>[];
const provider = vi.fn();

// Exercise the actual edge handler without Deno networking or provider spending.
const source = readFileSync("supabase/functions/telephony-api/index.ts", "utf8");
const handlerSource = ts.transpileModule(source.slice(source.indexOf("serve(async")), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function request(body: Record<string, unknown>) {
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "advisor" } }, error: null }) },
    from: (table: string) => {
      let patch: Record<string, unknown> | undefined;
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const chain: Record<string, any> = {};
      chain.select = () => chain;
      chain.update = (value: Record<string, unknown>) => { patch = value; return chain; };
      chain.eq = (key: string, value: unknown) => { filters.push(r => r[key] === value); return chain; };
      chain.is = chain.eq;
      const resolve = () => {
        const row = table === "profiles" ? { tenant_id: "tenant", active_tenant_id: "tenant" }
          : table === "call_channels" ? { provider: "twilio", credentials_encrypted: "test" } : call;
        if (patch) {
          if (!filters.every(f => f(call))) return { data: null, error: null };
          writes.push(patch); Object.assign(call, patch);
        }
        return { data: table === "user_roles" ? [] : { ...row }, error: null };
      };
      chain.single = async () => resolve(); chain.maybeSingle = chain.single;
      chain.then = (f: (r: unknown) => void) => f(resolve());
      return chain;
    },
  };
  await new AsyncFunction("serve", "createClient", "SUPABASE_URL", "SERVICE_KEY", "Deno", "json", "decryptCredentials", "twilioRequest", handlerSource)(
    (fn: typeof handler) => { handler = fn; }, () => client, "https://test.invalid", "test", { env: { get: () => "test" } },
    (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }), async () => ({}), provider,
  );
  if (!handler) throw new Error("Handler not initialized");
  return handler(new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  writes = [];
  call = { id, tenant_id: "tenant", user_id: "advisor", channel_id: "channel", provider_call_id: "CA-test", ended_at: null, hangup_by: null, hangup_at: null };
  provider.mockReset().mockResolvedValue({ status: "completed" });
});

describe("authenticated hangup", () => {
  it("stores agent and exact action time before sending the provider command, ignoring claimed prospect", async () => {
    provider.mockImplementation(async () => {
      expect(call.hangup_by).toBe("agent");
      expect(Number.isFinite(Date.parse(String(call.hangup_at)))).toBe(true);
      return { status: "completed" };
    });
    expect((await request({ action: "end", call_id: id, hangup_by: "prospect" })).status).toBe(200);
    expect(provider).toHaveBeenCalledOnce();
    expect(call.hangup_by).toBe("agent");
    expect(writes[0]).not.toHaveProperty("ended_at");
    expect(writes[0]).not.toHaveProperty("duration_seconds");
  });
  it("does not relabel an already ended historical call", async () => {
    call.ended_at = "2026-11-21T20:25:00Z";
    expect((await request({ action: "end", call_id: id })).status).toBe(200);
    expect(writes).toEqual([]); expect(provider).not.toHaveBeenCalled();
  });
  it("rolls back attribution when the provider rejects the hangup", async () => {
    provider.mockRejectedValue(new Error("provider rejected"));
    expect((await request({ action: "end", call_id: id })).status).toBe(500);
    expect(call.hangup_by).toBeNull(); expect(call.hangup_at).toBeNull();
  });
  it("rejects another tenant before writing or contacting the provider", async () => {
    call.tenant_id = "other";
    expect((await request({ action: "end", call_id: id })).status).toBe(404);
    expect(writes).toEqual([]); expect(provider).not.toHaveBeenCalled();
  });
  it("rejects another advisor's call without management authorization", async () => {
    call.user_id = "other";
    expect((await request({ action: "end", call_id: id })).status).toBe(403);
    expect(writes).toEqual([]); expect(provider).not.toHaveBeenCalled();
  });
});