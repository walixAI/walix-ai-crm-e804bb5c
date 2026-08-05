import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantId } from "@/lib/queries/tenant";

/**
 * Acceso al Copiloto en la web.
 * Regla: administradores y plataforma siempre tienen acceso.
 * El resto lo tiene salvo que exista un registro de acceso ligado a su usuario
 * con el Copiloto web desactivado.
 */
export function useCopilotWebAccess() {
  const { user } = useAuth();
  const { isTenantAdmin, isPlatform } = usePermissions();
  const { data: tenantId } = useTenantId();

  const { data, isLoading } = useQuery({
    queryKey: ["copilot-web-access", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && !isTenantAdmin && !isPlatform,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_user_access")
        .select("web_enabled")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isTenantAdmin || isPlatform) return { allowed: true, loading: false };
  return { allowed: data ? data.web_enabled !== false : true, loading: isLoading };
}
