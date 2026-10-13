import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";

export interface HumanAttention {
  session_id: string;
  contact_id: string;
  contact_name: string;
  owner_id: string | null;
  owner_name: string | null;
  conversation_id: string | null;
  deal_id: string | null;
  handoff_at: string;
  reason: string | null;
  agent_name: string;
  channel: string | null;
}

export function attentionLink(item: HumanAttention) {
  return item.conversation_id ? `/whatsapp?conversationId=${item.conversation_id}` : `/contacts/${item.contact_id}`;
}

export function attentionPriority(a: { requiresAdvisor?: boolean }, b: { requiresAdvisor?: boolean }) {
  return Number(!!b.requiresAdvisor) - Number(!!a.requiresAdvisor);
}

export function useHumanAttention() {
  const userId = useAuthStore(s => s.user?.id);
  const tenantId = useAuthStore(s => s.activeTenantId);
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId || !tenantId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["human-attention", tenantId, userId] });
    const channel = supabase.channel(`attention:${tenantId}:${userId}:${crypto.randomUUID()}`);
    for (const table of ["sales_agent_sessions", "messages", "tasks", "contacts", "conversations"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}` }, refresh);
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, tenantId, userId]);
  return useQuery({
    queryKey: ["human-attention", tenantId, userId],
    enabled: !!tenantId && !!userId,
    refetchInterval: 10000,
    queryFn: async (): Promise<HumanAttention[]> => {
      const { data, error } = await supabase.rpc("pending_human_attention");
      if (error) throw error;
      return data ?? [];
    },
  });
}