import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
export interface InboundSettings {
  unassigned_mode: "specific" | "all" | "supervisors" | "advisors";
  unassigned_user_id: string | null;
  phone_mode: "none" | "all" | "selected";
  allowed_user_ids: string[];
}
export interface InboundPolicyResponse {
  can_manage: boolean; can_receive_phone: boolean; phone: string | null; phone_enabled: boolean;
  policy?: InboundSettings;
  members?: { id: string; full_name: string | null; phone: string | null }[];
}
export async function inboundRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("telephony-api", { body });
  let message = data?.error;
  if (error && "context" in error) { try { message = (await error.context.json()).error; } catch { /* non-JSON error */ } }
  if (error || message) throw new Error(message ?? "No se pudo guardar la configuración");
  return data;
}
export function useInboundPolicy() {
  const { user, activeTenantId } = useAuth();
  return useQuery<InboundPolicyResponse>({
    queryKey: ["inbound-policy", activeTenantId, user?.id], enabled: !!user && !!activeTenantId,
    queryFn: () => inboundRequest({ action: "inbound_policy" }), refetchInterval: 30000,
  });
}