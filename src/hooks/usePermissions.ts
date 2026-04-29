import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { can as canFn, canAccessRoute as canAccessRouteFn, primaryRole } from "@/lib/permissions";
import type { PermissionToken } from "@/constants/permissions";

export function usePermissions() {
  const { roles } = useAuth();

  return useMemo(() => {
    const isPlatformOwner = roles.includes("platform_owner") || roles.includes("super_admin");
    const isPlatformStaff = roles.includes("platform_staff");
    const isPlatform = isPlatformOwner || isPlatformStaff;
    const isOrgOwner = roles.includes("org_owner");
    const isTenantOwner = roles.includes("tenant_owner");
    const isTenantAdmin = roles.includes("tenant_admin") || isTenantOwner;

    return {
      roles,
      primaryRole: primaryRole(roles),
      isPlatformOwner,
      isPlatformStaff,
      isPlatform,
      isOrgOwner,
      isTenantOwner,
      isTenantAdmin,
      // Legacy alias
      isSuperAdmin: isPlatform,
      isManager: roles.includes("sales_manager"),
      isRep: roles.includes("sales_rep"),
      can: (token: PermissionToken) => canFn(roles, token),
      canAccess: (path: string) => canAccessRouteFn(roles, path),
    };
  }, [roles]);
}