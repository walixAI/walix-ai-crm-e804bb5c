import type { Role } from "@/store/auth";

/**
 * Permission tokens use the format `resource.action[.scope]`.
 * Scope is one of: `own | team | tenant` (defaults to `tenant` if omitted).
 * Wildcards `*` match any segment.
 */
export type PermissionToken = string;

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Soporte Walix",
  tenant_admin: "Administrador",
  sales_manager: "Gerente de Ventas",
  sales_rep: "Vendedor",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  super_admin: "Acceso global a todas las instancias. Solo equipo Walix.",
  tenant_admin: "Configura la empresa, gestiona equipo, pipeline y facturación.",
  sales_manager: "Ve y gestiona los datos de su equipo. Reasigna leads.",
  sales_rep: "Trabaja sus propios contactos, deals y conversaciones.",
};

/** Roles que un tenant_admin puede asignar al invitar miembros. */
export const INVITABLE_ROLES: Role[] = ["tenant_admin", "sales_manager", "sales_rep"];

/** Capacidades base por rol (tokens sin expandir). */
export const ROLE_CAPABILITIES: Record<Role, PermissionToken[]> = {
  super_admin: ["*"],
  tenant_admin: [
    "settings.*",
    "admin.tenant.read",
    "contacts.*",
    "deals.*",
    "pipeline.*",
    "reports.*",
    "automations.*",
    "whatsapp.*",
    "ai.*",
    "team.*",
    "billing.*",
    "audit.read",
    "templates.*",
  ],
  sales_manager: [
    "contacts.read.team",
    "contacts.update.team",
    "deals.read.team",
    "deals.update.team",
    "deals.reassign.team",
    "pipeline.read",
    "reports.read.team",
    "automations.read",
    "whatsapp.use",
    "ai.use",
    "templates.read",
  ],
  sales_rep: [
    "contacts.read.own",
    "contacts.update.own",
    "contacts.create",
    "deals.read.own",
    "deals.update.own",
    "deals.create",
    "pipeline.read",
    "reports.read.own",
    "automations.read",
    "automations.use",
    "whatsapp.use",
    "ai.use",
    "templates.read",
  ],
};

/** Rutas y el permiso requerido para acceder. */
export const ROUTE_PERMISSIONS: Record<string, PermissionToken | null> = {
  "/dashboard": null,
  "/ai-inbox": "ai.use",
  "/contacts": "contacts.read",
  "/pipeline": "pipeline.read",
  "/whatsapp": "whatsapp.use",
  "/reports": "reports.read",
  "/automations": "automations.read",
  "/settings": "settings.read",
  "/admin": "admin.tenant.read",
  "/marketplace": null,
};