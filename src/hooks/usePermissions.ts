import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { can as canFn, canAccessRoute as canAccessRouteFn, primaryRole } from "@/lib/permissions";
import type { PermissionToken } from "@/constants/permissions";

export function usePermissions() {
  const { roles } = useAuth();

  return useMemo(() => {
    return {
      roles,
      primaryRole: primaryRole(roles),
      isSuperAdmin: roles.includes("super_admin"),
      isTenantAdmin: roles.includes("tenant_admin"),
      isManager: roles.includes("sales_manager"),
      isRep: roles.includes("sales_rep"),
      can: (token: PermissionToken) => canFn(roles, token),
      canAccess: (path: string) => canAccessRouteFn(roles, path),
    };
  }, [roles]);
}