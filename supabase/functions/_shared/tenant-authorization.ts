export function hasTenantManagementRole(roles: { role: string; tenant_id: string | null }[], tenantId: string, allowManager = false): boolean {
  const tenantRoles = allowManager ? ["tenant_owner", "tenant_admin", "sales_manager"] : ["tenant_owner", "tenant_admin"];
  return roles.some((r) => (r.tenant_id === tenantId && tenantRoles.includes(r.role)) ||
    (r.tenant_id === null && ["platform_owner", "platform_staff"].includes(r.role)));
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}