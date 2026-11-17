export interface PhoneCallPolicy { allow_all: boolean; allowed_user_ids: string[] }

export function canUsePhone(policy: PhoneCallPolicy | null, userId: string, isActiveMember: boolean): boolean {
  return isActiveMember && (!policy || policy.allow_all || policy.allowed_user_ids.includes(userId));
}

export function canEditPhonePolicy(roles: string[]): boolean {
  return roles.includes("tenant_owner") || roles.includes("tenant_admin");
}