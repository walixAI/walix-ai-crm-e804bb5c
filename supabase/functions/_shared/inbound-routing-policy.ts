export interface InboundPolicy {
  unassigned_mode: "specific" | "all" | "supervisors" | "advisors";
  unassigned_user_id: string | null;
  phone_mode: "none" | "all" | "selected";
  allowed_user_ids: string[];
}
export const defaultInboundPolicy: InboundPolicy = { unassigned_mode: "supervisors", unassigned_user_id: null, phone_mode: "all", allowed_user_ids: [] };
export function inboundRecipients(policy: InboundPolicy, roles: { user_id: string; role: string }[], ownerId: string | null): string[] {
  if (ownerId && roles.some(r => r.user_id === ownerId)) return [ownerId];
  return [...new Set(roles.filter(r => policy.unassigned_mode === "all" ||
    (policy.unassigned_mode === "specific" && r.user_id === policy.unassigned_user_id) ||
    (policy.unassigned_mode === "supervisors" && ["tenant_owner", "tenant_admin", "sales_manager"].includes(r.role)) ||
    (policy.unassigned_mode === "advisors" && r.role === "sales_rep")).map(r => r.user_id))];
}
export function mayReceivePhone(policy: InboundPolicy, userId: string): boolean {
  return policy.phone_mode === "all" || (policy.phone_mode === "selected" && policy.allowed_user_ids.includes(userId));
}
export function profileReceivingPhone(phone: string | null | undefined, enabled: boolean, allowed: boolean, channelNumbers: string[]): string | null {
  const value = (phone ?? "").trim().replace(/[\s()-]/g, "");
  if (!enabled || !allowed || !/^\+[1-9]\d{7,14}$/.test(value) || channelNumbers.some(n => n.replace(/\D/g, "").slice(-10) === value.replace(/\D/g, "").slice(-10))) return null;
  return value;
}