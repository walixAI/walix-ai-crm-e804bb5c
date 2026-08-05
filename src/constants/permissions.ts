import type { Role } from "@/store/auth";

/**
 * Permission tokens use the format `resource.action[.scope]`.
 * Scope is one of: `own | team | tenant` (defaults to `tenant` if omitted).
 * Wildcards `*` match any segment.
 */
export type PermissionToken = string;

export const ROLE_LABEL: Record<Role, string> = {
  platform_owner: "Walix Owner",
  platform_staff: "Walix Staff",
  org_owner: "Propietario de cuenta",
  org_member: "Miembro de cuenta",
  tenant_owner: "Propietario de empresa",
  tenant_admin: "Administrador",
  sales_manager: "Gerente de Ventas",
  sales_rep: "Vendedor",
  super_admin: "Soporte Walix (legacy)",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  platform_owner: "Dueño de la plataforma. Acceso total irrestricto a todas las instancias.",
  platform_staff: "Equipo Walix. Gestiona tenants, soporte, ventas. Sin acceso destructivo.",
  org_owner: "Dueño de la cuenta. Crea y gestiona varias empresas dentro de su organización.",
  org_member: "Miembro de la organización con acceso limitado a empresas asignadas.",
  tenant_owner: "Propietario de la empresa. Recibe la factura y puede transferir propiedad.",
  tenant_admin: "Configura la empresa, gestiona equipo y pipeline. No toca facturación.",
  sales_manager: "Ve y gestiona los datos de su equipo. Reasigna leads.",
  sales_rep: "Trabaja sus propios contactos, deals y conversaciones.",
  super_admin: "Rol legacy. Migrado a platform_owner.",
};

/** Roles que un tenant_admin/owner puede asignar al invitar miembros. */
export const INVITABLE_ROLES: Role[] = ["tenant_admin", "sales_manager", "sales_rep"];

/** Capacidades base por rol (tokens sin expandir). */
export const ROLE_CAPABILITIES: Record<Role, PermissionToken[]> = {
  platform_owner: ["*"],
  platform_staff: [
    "platform.read",
    "platform.tenants.manage",
    "platform.tenants.suspend",
    "platform.tenants.change_plan",
    "platform.impersonate",
    "admin.tenant.read",
    // Sin: platform.tenants.delete, platform.staff.manage
  ],
  super_admin: ["*"], // alias legacy
  org_owner: [
    "org.read",
    "org.tenants.create",
    "org.tenants.delete",
    "org.members.manage",
    "org.transfer",
  ],
  org_member: ["org.read"],
  tenant_owner: [
    "settings.*",
    "billing.*",
    "tenant.transfer",
    "tenant.cancel",
    "team.*",
    "contacts.*",
    "deals.*",
    "pipeline.*",
    "reports.*",
    "automations.*",
    "whatsapp.*",
    "ai.*",
    "audit.read",
    "templates.*",
    "admin.tenant.read",
  ],
  tenant_admin: [
    "settings.*",
    "billing.read",
    "admin.tenant.read",
    "contacts.*",
    "deals.*",
    "pipeline.*",
    "reports.*",
    "automations.*",
    "whatsapp.*",
    "ai.*",
    "team.*",
    "audit.read",
    "templates.*",
    // Sin: billing.*, tenant.transfer, tenant.cancel
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
    "team.read",
    "settings.me",
    "settings.read",
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
    "settings.me",
    "settings.read",
    "whatsapp.use",
    "ai.use",
    "templates.read",
  ],
};

/** Permiso requerido por pestaña de Configuración. */
export const SETTINGS_TAB_PERMISSIONS: Record<string, PermissionToken> = {
  general: "settings.branding",
  team: "team.read",
  pipeline: "settings.pipeline",
  contacts: "settings.contacts",
  outcomes: "settings.pipeline",
  goals: "settings.goals",
  expenses: "settings.expenses",
  widgets: "settings.widgets",
  import: "settings.import",
  whatsapp: "settings.whatsapp",
  modules: "settings.modules",
  agents: "ai.manage",
  copilot: "ai.manage",
  me: "settings.me",
  billing: "billing.read",
  activity: "audit.read",
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
  "/tasks": null,
  "/mi-dia": null,
  "/gastos": null,
  "/equipo": "reports.read.team",
  "/admin": "admin.tenant.read",
  "/org": "org.read",
  "/platform": "platform.read",
  "/marketplace": null,
};