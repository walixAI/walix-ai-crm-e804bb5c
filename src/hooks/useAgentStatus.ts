import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AgentReason = { id: string; name: string; kind: "available" | "pause" | "offline"; max_minutes: number | null; productive: boolean; sort_order: number };

export function useAgentReasons() {
  const { activeTenantId } = useAuth();
  return useQuery({
    queryKey: ["agent-reasons", activeTenantId], enabled: !!activeTenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_status_reasons").select("id,name,kind,max_minutes,productive,sort_order").eq("tenant_id", activeTenantId!).eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as AgentReason[];
    },
  });
}

export function useAgentStatus() {
  const { user, activeTenantId } = useAuth();
  const qc = useQueryClient();
  const key = ["agent-status", activeTenantId, user?.id];
  const status = useQuery({
    queryKey: key, enabled: !!activeTenantId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_status_current").select("reason_id,kind,reason_name,since").eq("tenant_id", activeTenantId!).eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  // Heartbeat every minute keeps "Disponible" valid; a lost browser stops ringing after 3 minutes.
  useEffect(() => {
    if (!activeTenantId || !user) return;
    const beat = () => supabase.rpc("agent_status_heartbeat").then(({ data }) => { if ((data as any)?.reconnected) qc.invalidateQueries({ queryKey: key }); });
    void beat();
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, user?.id]);
  const change = useMutation({
    mutationFn: async ({ reasonId, userId, cause }: { reasonId: string; userId?: string; cause?: string }) => {
      const { error } = await supabase.rpc("set_agent_status", { _reason_id: reasonId, _user_id: userId ?? null, _cause: cause ?? "manual" } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["agent-team"] }); qc.invalidateQueries({ queryKey: ["agent-log"] }); },
  });
  return { status: status.data, change };
}

/** Called before sign-out so the log records the exact disconnection time. */
export async function markAgentOffline(tenantId: string | null) {
  if (!tenantId) return;
  const { data } = await supabase.from("agent_status_reasons").select("id").eq("tenant_id", tenantId).eq("kind", "offline").order("sort_order").limit(1).maybeSingle();
  if (data) await supabase.rpc("set_agent_status", { _reason_id: data.id, _user_id: null, _cause: "logout" } as any);
}
