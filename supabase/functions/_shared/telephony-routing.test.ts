import { describe, expect, it } from "vitest";
import { routeInboundCall } from "./telephony-routing";

function fakeAdmin(owner: string | null, queue: string[] = [], preference: { phone_enabled: boolean; phone_number: string } | null = null) {
  const inserted: Record<string, any>[] = [];
  const admin = { from(table: string) {
    let insert: Record<string, any> | undefined;
    const q: any = {
      select: () => q, eq: () => q, ilike: () => q, order: () => q, limit: () => q, in: () => q, gte: () => q,
      insert: (row: Record<string, any>) => { insert = row; inserted.push(row); return q; },
      single: async () => ({ data: { ...insert, id: "call-1" }, error: null }),
      maybeSingle: async () => ({ data: table === "contacts" ? { id: "contact-1", owner_id: owner, name: "Lead" } : table === "profiles" ? { is_active: true } : table === "tenants" ? { timezone: "America/Mexico_City" } : table === "tenant_call_receiving_preferences" ? preference : null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: table === "user_roles" ? [{ user_id: owner ?? queue[0], role: "sales_rep" }] : table === "profiles" ? [{ id: owner ?? queue[0], is_active: true, phone: "+525500000001" }] : table === "tenant_call_receiving_preferences" && preference ? [{ user_id: owner ?? queue[0], ...preference }] : [], error: null }).then(resolve),
    };
    return q;
  } };
  return { admin, inserted };
}

describe("enrutamiento de entrantes para devolución", () => {
  const channel = { id: "channel", tenant_id: "tenant", phone_number: "+525571000589", pbx_config: { enabled: false } };
  it("conserva al asesor del lead y no inventa que contestó", async () => {
    const { admin, inserted } = fakeAdmin("advisor");
    await routeInboundCall(admin, { channel, fromNumber: "+525500000000", providerCallId: "CA1", notificationOnly: true });
    expect(inserted[0].user_id).toBe("advisor");
    expect(inserted[0].status).toBe("no_answer");
    expect(inserted[0].ended_at).toBeTruthy();
    expect(inserted[0].answered_at).toBeUndefined();
  });
  it("lead sin asesor usa la fila configurada", async () => {
    const { admin, inserted } = fakeAdmin(null, ["queue-advisor"]);
    await routeInboundCall(admin, { channel: { ...channel, pbx_config: { enabled: false, queue_user_ids: ["queue-advisor"] } }, fromNumber: "+525500000000", providerCallId: "CA2", notificationOnly: true });
    expect(inserted[0].user_id).toBe("queue-advisor");
    expect(inserted[0].status).toBe("no_answer");
  });
  it("sin fila ni asesor no deja la llamada sonando indefinidamente", async () => {
    const { admin, inserted } = fakeAdmin(null);
    await routeInboundCall(admin, { channel, fromNumber: "+525500000000", providerCallId: "CA3" });
    expect(inserted[0].user_id).toBeNull();
    expect(inserted[0].status).toBe("no_answer");
    expect(inserted[0].ended_at).toBeTruthy();
  });
  it("solo avisa si el usuario no ha activado recepción en celular", async () => {
    const { admin, inserted } = fakeAdmin("advisor", [], { phone_enabled: false, phone_number: "+525500000001" });
    const result = await routeInboundCall(admin, { channel, fromNumber: "+525500000000", providerCallId: "CA4", useReceivingPreference: true });
    expect(result.receivingPhone).toBeNull();
    expect(inserted[0].status).toBe("no_answer");
  });
  it("desvía al número del perfil, no al número antiguo de la preferencia", async () => {
    const { admin, inserted } = fakeAdmin("advisor", [], { phone_enabled: true, phone_number: "+525500000099" });
    const result = await routeInboundCall(admin, { channel, fromNumber: "+525500000000", providerCallId: "CA5", useReceivingPreference: true });
    expect(result.receivingPhone).toBe("+525500000001");
    expect(inserted[0].status).toBe("ringing");
    expect(inserted[0].ended_at).toBeNull();
    expect(inserted[0].metadata.notification_user_ids).toEqual(["advisor"]);
    expect(result.receivingTargets).toEqual([{ user_id: "advisor", phone: "+525500000001" }]);
  });
});