import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearPrivateCache, privateScope } from "./queryIsolation";

describe("private query isolation", () => {
  it("separates identities, tenants and permissions", () => {
    const state = { user: { id: "advisor-a" }, activeTenantId: "tenant-a", roles: ["sales_rep"] };
    const key = privateScope(state);
    expect(privateScope({ ...state, user: { id: "advisor-b" } })).not.toBe(key);
    expect(privateScope({ ...state, activeTenantId: "tenant-b" })).not.toBe(key);
    expect(privateScope({ ...state, roles: ["tenant_owner"] })).not.toBe(key);
  });
  it("removes cached commercial data and weekly reports, preserving login storage", () => {
    const client = new QueryClient();
    client.setQueryData(["dashboard-kpis"], { pipelineValue: 900 });
    localStorage.setItem("walix.weeklyReport.v1", "private report");
    localStorage.setItem("unrelated-setting", "keep");
    clearPrivateCache(client);
    expect(client.getQueryData(["dashboard-kpis"])).toBeUndefined();
    expect(localStorage.getItem("walix.weeklyReport.v1")).toBeNull();
    expect(localStorage.getItem("unrelated-setting")).toBe("keep");
  });
});