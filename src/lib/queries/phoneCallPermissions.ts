import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";

export interface PhonePermissions {
  can_manage: boolean;
  can_use_phone: boolean;
  policy?: { allow_all: boolean; allowed_user_ids: string[] };
  members?: { id: string; full_name: string | null; phone: string | null }[];
}

export async function phonePermissionRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("telephony-api", { body });
  if (error) {
    let message = "No se pudieron consultar o guardar los permisos de llamadas";
    if ("context" in error) {
      try { message = (await error.context.json()).error ?? message; } catch { /* No JSON */ }
    }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error ?? "No se pudieron guardar los permisos");
  return data;
}

export function usePhoneCallPermissions(enabled = true) {
  const { data: tenantId } = useTenantId();
  return useQuery<PhonePermissions>({
    queryKey: ["phone-call-permissions", tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 0,
    queryFn: () => phonePermissionRequest({ action: "phone_permissions" }),
  });
}