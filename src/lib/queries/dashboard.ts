import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiBundle {
  pipelineValue: number;
  pipelineDeltaPct: number;
  activeDeals: number;
  staleDeals: number;
  messagesToday: number;
  messagesUnanswered: number;
  closeRate: number;
  closeRateDelta: number;
}

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async (): Promise<KpiBundle> => {
      const { data: deals, error: e1 } = await supabase
        .from("deals").select("amount,is_won,is_lost,updated_at");
      if (e1) throw e1;
      const active = (deals ?? []).filter(d => !d.is_won && !d.is_lost);
      const won = (deals ?? []).filter(d => d.is_won).length;
      const lost = (deals ?? []).filter(d => d.is_lost).length;
      const closeRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
      const pipelineValue = active.reduce((s, d) => s + Number(d.amount), 0);
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
      const stale = active.filter(d => (d.updated_at ?? "") < tenDaysAgo).length;

      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const { count: msgCount } = await supabase
        .from("messages").select("*", { count: "exact", head: true })
        .gte("sent_at", startOfDay.toISOString());
      const { count: unanswered } = await supabase
        .from("conversations").select("*", { count: "exact", head: true })
        .gt("unread_count", 0);

      return {
        pipelineValue, pipelineDeltaPct: 12,
        activeDeals: active.length, staleDeals: stale,
        messagesToday: msgCount ?? 0, messagesUnanswered: unanswered ?? 0,
        closeRate, closeRateDelta: 3,
      };
    },
  });
}

export interface RecentActivityRow {
  id: string;
  type: string;
  description: string;
  occurredAt: string;
  contactId: string | null;
  contactName: string | null;
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ["recent-activity", limit],
    queryFn: async (): Promise<RecentActivityRow[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select("id,type,description,occurred_at,contact_id,contacts(name,last_name)")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        id: a.id, type: a.type, description: a.description,
        occurredAt: a.occurred_at, contactId: a.contact_id,
        contactName: a.contacts ? `${a.contacts.name} ${a.contacts.last_name ?? ""}`.trim() : null,
      }));
    },
  });
}

export function useDashboardAiSuggestions() {
  return useQuery({
    queryKey: ["dashboard-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("id,text,cta")
        .is("contact_id", null)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePipelineByStage() {
  return useQuery({
    queryKey: ["pipeline-by-stage"],
    queryFn: async () => {
      const { data: stages, error: e1 } = await supabase
        .from("pipeline_stages").select("id,name,position").order("position");
      if (e1) throw e1;
      const { data: deals, error: e2 } = await supabase
        .from("deals").select("amount,stage_id,is_won,is_lost");
      if (e2) throw e2;
      return (stages ?? []).map(s => ({
        stage: s.name,
        value: (deals ?? [])
          .filter(d => d.stage_id === s.id && !d.is_won && !d.is_lost)
          .reduce((sum, d) => sum + Number(d.amount), 0),
      }));
    },
  });
}

export function useDealsClosedTimeline(days = 30) {
  return useQuery({
    queryKey: ["deals-closed-timeline", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000);
      since.setHours(0,0,0,0);
      const { data, error } = await supabase
        .from("deals").select("amount,updated_at,is_won")
        .eq("is_won", true).gte("updated_at", since.toISOString());
      if (error) throw error;
      const buckets = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(since); d.setDate(since.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      (data ?? []).forEach((d: any) => {
        const k = String(d.updated_at).slice(0, 10);
        buckets.set(k, (buckets.get(k) ?? 0) + Number(d.amount));
      });
      return Array.from(buckets.entries()).map(([k, v], i) => ({
        day: String(i + 1), date: k, value: v,
      }));
    },
  });
}