import { expect, it } from "vitest";
import { hasTenantManagementRole, isUuid } from "./tenant-authorization";
it("does not grant tenant B administration from tenant A", () => {
  expect(hasTenantManagementRole([{ role: "tenant_admin", tenant_id: "A" }, { role: "sales_rep", tenant_id: "B" }], "B")).toBe(false);
  expect(hasTenantManagementRole([{ role: "tenant_owner", tenant_id: "B" }], "B")).toBe(true);
});
it("automation managers remain read only", () => {
  expect(hasTenantManagementRole([{ role: "sales_manager", tenant_id: "B" }], "B")).toBe(false);
  expect(hasTenantManagementRole([{ role: "sales_manager", tenant_id: "B" }], "B", true)).toBe(true);
});
it("allows only global platform roles, not a fabricated tenant-scoped platform role", () => {
  expect(hasTenantManagementRole([{ role: "platform_owner", tenant_id: null }], "B")).toBe(true);
  expect(hasTenantManagementRole([{ role: "platform_owner", tenant_id: "A" }], "B")).toBe(false);
});
it("rejects filter syntax instead of accepting it as an identifier", () => {
  expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
  expect(isUuid("x,outcome_id.is.null")).toBe(false);
});