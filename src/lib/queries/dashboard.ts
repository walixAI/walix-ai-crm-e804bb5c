import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computePipelineHealth, type PipelineHealth } from "@/lib/pipelineHealth";

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
      const [actsRes, tasksRes] = await Promise.all([
        supabase
          .from("activities")
          .select("id,type,description,occurred_at,contact_id,contacts(name,last_name)")
          .order("occurred_at", { ascending: false })
          .limit(limit),
        supabase
          .from("tasks")
          .select("id,title,completed,due_at,created_at,contact_id,contacts(name,last_name)")
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);
      if (actsRes.error) throw actsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      const acts: RecentActivityRow[] = (actsRes.data ?? []).map((a: any) => ({
        id: a.id, type: a.type, description: a.description,
        occurredAt: a.occurred_at, contactId: a.contact_id,
        contactName: a.contacts ? `${a.contacts.name} ${a.contacts.last_name ?? ""}`.trim() : null,
      }));
      const taskActs: RecentActivityRow[] = (tasksRes.data ?? []).map((t: any) => ({
        id: `task-${t.id}`,
        type: "task",
        description: `${t.completed ? "Tarea completada" : "Tarea"}: ${t.title}`,
        occurredAt: t.due_at ?? t.created_at,
        contactId: t.contact_id,
        contactName: t.contacts ? `${t.contacts.name} ${t.contacts.last_name ?? ""}`.trim() : null,
      }));
      return [...acts, ...taskActs]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, limit);
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

export function usePipelineHealthScore() {
  return useQuery<PipelineHealth>({
    queryKey: ["pipeline-health-score"],
    queryFn: async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [dealsRes, convRes, contactsRes] = await Promise.all([
        supabase.from("deals").select("amount,probability,is_won,is_lost,expected_close_date,updated_at,contact_id"),
        supabase.from("conversations").select("unread_count,status"),
        supabase.from("contacts").select("id,last_activity_at"),
      ]);
      if (dealsRes.error) throw dealsRes.error;
      if (convRes.error) throw convRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const deals = dealsRes.data ?? [];
      const conversations = convRes.data ?? [];
      const contacts = contactsRes.data ?? [];

      const lastActivityMap = new Map<string, string | null>();
      for (const c of contacts) lastActivityMap.set(c.id, c.last_activity_at);

      const active = deals.filter((d) => !d.is_won && !d.is_lost);
      const staleActiveDeals = active.filter((d) => {
        const ref = (d.contact_id && lastActivityMap.get(d.contact_id)) || d.updated_at;
        return !ref || ref < tenDaysAgo;
      }).length;
      const overdueActiveDeals = active.filter(
        (d) => d.expected_close_date && d.expected_close_date < today,
      ).length;
      const weightedForecast = active.reduce(
        (s, d) => s + (Number(d.amount) * Number(d.probability)) / 100,
        0,
      );

      const openConvos = conversations.filter((c) => c.status !== "Resuelto");
      const totalOpenConversations = openConvos.length;
      const unreadOpenConversations = openConvos.filter((c) => (c.unread_count ?? 0) > 0).length;

      const wonLast30 = deals.filter((d) => d.is_won && d.updated_at >= thirtyDaysAgo).length;
      const lostLast30 = deals.filter((d) => d.is_lost && d.updated_at >= thirtyDaysAgo).length;

      return computePipelineHealth({
        activeDeals: active.length,
        staleActiveDeals,
        overdueActiveDeals,
        totalOpenConversations,
        unreadOpenConversations,
        weightedForecast,
        monthlyTarget: 0,
        wonLast30,
        lostLast30,
      });
    },
  });
}