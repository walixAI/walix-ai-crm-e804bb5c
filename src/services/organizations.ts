import { supabase } from "@/integrations/supabase/client";

export interface CreateTenantPayload {
  organization_id: string;
  name: string;
  plan: string;
}

/**
 * Crea un nuevo tenant dentro de una organización.
 * Solo disponible para org_owner. Aplica límites de plan.
 * Sin trial: tenants creados aquí se cobran desde día 1.
 */
export async function createTenant(payload: CreateTenantPayload) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("No autenticado");

  // Validar límite de plan
  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", payload.organization_id)
    .maybeSingle();
  if (!org) throw new Error("Organización no encontrada");

  const { data: limit } = await supabase
    .from("org_plan_limits")
    .select("max_tenants")
    .eq("plan", org.plan)
    .maybeSingle();

  const { count } = await supabase
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", payload.organization_id);

  if (limit && count != null && count >= limit.max_tenants) {
    throw new Error(
      `Has alcanzado el límite de ${limit.max_tenants} empresa(s) para tu plan. Mejora tu plan de organización para crear más.`,
    );
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      name: payload.name,
      plan: payload.plan,
      organization_id: payload.organization_id,
      // Sin trial_ends_at: cobra desde día 1
    })
    .select("id")
    .single();
  if (error) throw error;

  // Asignar al creador como tenant_owner + tenant_admin
  await supabase.from("user_roles").insert([
    { user_id: user.user.id, role: "tenant_owner", tenant_id: tenant.id },
    { user_id: user.user.id, role: "tenant_admin", tenant_id: tenant.id },
  ]);

  return tenant.id;
}

/**
 * Cambia el tenant activo del usuario en sesión.
 * Solo permite cambiar a tenants donde el usuario tenga acceso.
 */
export async function switchTenant(tenantId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("profiles")
    .update({ active_tenant_id: tenantId })
    .eq("id", user.user.id);
  if (error) throw error;
}
