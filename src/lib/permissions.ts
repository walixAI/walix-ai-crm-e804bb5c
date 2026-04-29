import type { Role } from "@/store/auth";
import {
  ROLE_CAPABILITIES,
  ROUTE_PERMISSIONS,
  type PermissionToken,
} from "@/constants/permissions";

/**
 * Returns true if a token capability matches the requested permission.
 *
 * Match rules:
 *  - "*" matches anything
 *  - segment-by-segment match; "*" wildcards a single segment
 *  - if capability scope is omitted, it implicitly grants the broadest scope
 *    ("contacts.read" grants "contacts.read.own", ".team", ".tenant")
 *  - if requested scope is omitted, capability must also be wildcard or the
 *    broadest scope ("tenant")
 */
function tokenMatches(capability: PermissionToken, requested: PermissionToken): boolean {
  if (capability === "*") return true;
  const cap = capability.split(".");
  const req = requested.split(".");

  // Pad capability with implicit wildcards if shorter than request
  // ("contacts.*" should grant "contacts.read.own")
  while (cap.length < req.length) cap.push("*");
  // If capability is more specific than requested, it cannot grant the broader request
  if (cap.length > req.length) {
    // unless the extra segments are scopes and requested is broader ("contacts.read" requested
    // should be granted by "contacts.read" but NOT by "contacts.read.own")
    return false;
  }

  return cap.every((c, i) => c === "*" || c === req[i]);
}

export function can(roles: Role[], requested: PermissionToken): boolean {
  if (!roles || roles.length === 0) return false;
  for (const role of roles) {
    const caps = ROLE_CAPABILITIES[role] ?? [];
    for (const cap of caps) {
      if (tokenMatches(cap, requested)) return true;
    }
  }
  return false;
}

export function canAccessRoute(roles: Role[], path: string): boolean {
  // Match longest known prefix
  const keys = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
  const match = keys.find((k) => path === k || path.startsWith(k + "/"));
  if (!match) return true; // unknown route -> allow (auth still required upstream)
  const required = ROUTE_PERMISSIONS[match];
  if (required === null) return true;
  return can(roles, required);
}

export function primaryRole(roles: Role[]): Role | null {
  const order: Role[] = [
    "platform_owner",
    "platform_staff",
    "super_admin",
    "org_owner",
    "tenant_owner",
    "tenant_admin",
    "sales_manager",
    "sales_rep",
    "org_member",
  ];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}