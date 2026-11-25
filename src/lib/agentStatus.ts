import { supabase } from "@/integrations/supabase/client";

/**
 * Solo se llama al autenticar desde una sesión cerrada, nunca al restaurarla.
 * No usa marcas por pestaña: cada inicio de sesión real debe activar Disponible.
 */
export async function markAgentAvailableOnLogin(userId: string, tenantId: string | null) {
  if (!userId || !tenantId) return;
  const { data } = await supabase
    .from("agent_status_reasons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("kind", "available")
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!data) return;
  const { error } = await supabase.rpc("set_agent_status", {
    _reason_id: data.id,
    _user_id: null,
    _cause: "login",
  } as any);
  if (error) throw error;
}
