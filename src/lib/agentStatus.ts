import { supabase } from "@/integrations/supabase/client";

const LOGIN_FLAG_PREFIX = "agent-status-login:";

function loginFlagKey(userId: string, tenantId: string) {
  return `${LOGIN_FLAG_PREFIX}${userId}:${tenantId}`;
}

/**
 * Pone al asesor en "Disponible" al iniciar sesión. La marca en sessionStorage
 * evita reiniciar el estado en cada recarga de página dentro de la misma sesión
 * del navegador (si el asesor se puso en pausa, una recarga no lo reactiva).
 */
export async function markAgentAvailableOnLogin(userId: string, tenantId: string | null) {
  if (!tenantId) return;
  try {
    if (sessionStorage.getItem(loginFlagKey(userId, tenantId))) return;
  } catch {
    // sessionStorage bloqueado: igual intentamos marcar disponible una vez.
  }
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
  try {
    sessionStorage.setItem(loginFlagKey(userId, tenantId), "1");
  } catch {
    // ignore
  }
}
