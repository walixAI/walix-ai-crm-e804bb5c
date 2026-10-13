import { describe, expect, it } from "vitest";
import { notifyAgentNoReply } from "./agent-no-reply";

describe("Avisos por límite de respuestas", () => {
  function setup(recent: any[] = []) {
    const writes: any[] = [];
    const filters: any[] = [];
    const sb = { from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: (...args: any[]) => { filters.push([table, ...args]); return chain; },
        in: (_key: string, roles: string[]) => { expect(roles).toContain("sales_manager"); return chain; },
        gte: () => chain,
        contains: (_key: string, value: any) => { expect(value.reason).toBe("tope_diario"); return chain; },
        maybeSingle: async () => ({ data: table === "contacts" ? { name: "Juan", owner_id: "advisor" } : { assignee_id: "assignee" } }),
        insert: (rows: any[]) => { writes.push(...rows); return chain; },
        then: (resolve: any) => resolve({ data: table === "user_roles" ? [{ user_id: "manager" }, { user_id: "owner" }, { user_id: "advisor" }] : recent, error: null }),
      };
      return chain;
    } };
    return { sb, writes, filters };
  }
  const params = { tenantId: "tenant", contactId: "contact", conversationId: "conversation", reason: "tope_diario", why: "se alcanzó el límite diario" };
  it("avisa a responsables, supervisor y dueño sin duplicar usuarios y con enlace", async () => {
    const { sb, writes, filters } = setup();
    await notifyAgentNoReply(sb, params);
    expect(writes.map((r) => r.user_id)).toEqual(["advisor", "assignee", "manager", "owner"]);
    expect(writes.every((r) => r.title.includes("límite diario") && r.link === "/whatsapp?conversationId=conversation" && r.tenant_id === "tenant")).toBe(true);
    for (const table of ["contacts", "conversations", "user_roles", "notifications"]) expect(filters).toContainEqual([table, "tenant_id", "tenant"]);
  });
  it("completa destinatarios faltantes aunque otro ya recibió un aviso", async () => {
    const { sb, writes } = setup([{ user_id: "advisor" }, { user_id: "owner" }]);
    await notifyAgentNoReply(sb, params);
    expect(writes.map((r) => r.user_id)).toEqual(["assignee", "manager"]);
  });
  it("no repite el aviso del mismo motivo dentro de 24 horas", async () => {
    const { sb, writes } = setup(["advisor", "assignee", "manager", "owner"].map((user_id) => ({ user_id })));
    await notifyAgentNoReply(sb, params);
    expect(writes).toHaveLength(0);
  });
});