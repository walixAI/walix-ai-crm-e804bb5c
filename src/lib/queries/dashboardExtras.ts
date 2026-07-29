import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers, resolveOwner } from "@/lib/queries/tenantUsers";

export interface PipelineBreakdownRow {
  pipelineId: string;
  pipelineName: string;
  activeCount: number;
  value: number;
}

interface StageLite { id: string; name: string; position: number; is_won: boolean; is_lost: boolean; pipeline_id: string | null }

async function loadBase() {
  const [pRes, sRes, dRes] = await Promise.all([
    supabase.from("pipelines").select("id,name,position").order("position"),
    supabase.from("pipeline_stages").select("id,name,position,is_won,is_lost,pipeline_id").order("position"),
    supabase.from("deals").select("id,name,amount,stage_id,stage_name,is_won,is_lost,owner_id,contact_id,expected_close_date,probability,updated_at"),
  ]);
  if (pRes.error) throw pRes.error;
  if (sRes.error) throw sRes.error;
  if (dRes.error) throw dRes.error;
  return {
    pipelines: (pRes.data ?? []) as { id: string; name: string; position: number }[],
    stages: (sRes.data ?? []) as unknown as StageLite[],
    deals: (dRes.data ?? []) as any[],
  };
}

/** Value + active deal count per pipeline. */
export function usePipelineBreakdown() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["pipeline-breakdown", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<PipelineBreakdownRow[]> => {
      const { pipelines, stages, deals } = await loadBase();
      const stagePipeline = new Map(stages.map((s) => [s.id, s.pipeline_id]));
      const rows: PipelineBreakdownRow[] = pipelines.map((p) => ({
        pipelineId: p.id, pipelineName: p.name, activeCount: 0, value: 0,
      }));
      const byId = new Map(rows.map((r) => [r.pipelineId, r]));
      for (const d of deals) {
        if (d.is_won || d.is_lost) continue;
        const pid = d.stage_id ? stagePipeline.get(d.stage_id) ?? null : null;
        const row = pid ? byId.get(pid) : null;
        if (!row) continue;
        row.activeCount += 1;
        row.value += Number(d.amount ?? 0);
      }
      return rows;
    },
  });
}

export interface ClosingSoonDeal {
  id: string;
  name: string;
  amount: number;
  stageName: string;
  pipelineName: string;
  ownerName: string;
  contactId: string | null;
  expectedCloseDate: string | null;
}

/** Deals sitting in the stage right before "Ganado" of each pipeline. */
export function useClosingSoon() {
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["closing-soon", tenantId, users?.length ?? 0],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<ClosingSoonDeal[]> => {
      const { pipelines, stages, deals } = await loadBase();
      const pipelineName = new Map(pipelines.map((p) => [p.id, p.name]));
      // target stage per pipeline = highest position stage that is not won/lost and sits before the won stage
      const targetStages = new Map<string, StageLite>(); // stageId -> stage
      const byPipeline = new Map<string, StageLite[]>();
      for (const s of stages) {
        const key = s.pipeline_id ?? "__none";
        if (!byPipeline.has(key)) byPipeline.set(key, []);
        byPipeline.get(key)!.push(s);
      }
      for (const [, list] of byPipeline) {
        const sorted = [...list].sort((a, b) => a.position - b.position);
        const won = sorted.find((s) => s.is_won);
        const candidates = sorted.filter((s) => !s.is_won && !s.is_lost && (!won || s.position < won.position));
        const target = candidates[candidates.length - 1];
        if (target) targetStages.set(target.id, target);
      }
      return deals
        .filter((d) => !d.is_won && !d.is_lost && d.stage_id && targetStages.has(d.stage_id))
        .map((d) => {
          const st = targetStages.get(d.stage_id)!;
          return {
            id: d.id,
            name: d.name,
            amount: Number(d.amount ?? 0),
            stageName: st.name,
            pipelineName: (st.pipeline_id && pipelineName.get(st.pipeline_id)) || "General",
            ownerName: resolveOwner(users, d.owner_id).name,
            contactId: d.contact_id ?? null,
            expectedCloseDate: d.expected_close_date ?? null,
          };
        })
        .sort((a, b) => b.amount - a.amount);
    },
  });
}

export interface SimpleDeal {
  id: string; name: string; amount: number; stageName: string;
  ownerName: string; updatedAt: string; expectedCloseDate: string | null;
}

/** Active deals without activity for more than `days` days. */
export function useStaleDeals(days = 10) {
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["stale-deals", tenantId, days, users?.length ?? 0],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<SimpleDeal[]> => {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("deals")
        .select("id,name,amount,stage_name,owner_id,updated_at,expected_close_date,is_won,is_lost")
        .eq("is_won", false).eq("is_lost", false)
        .lt("updated_at", cutoff)
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: d.id, name: d.name, amount: Number(d.amount ?? 0),
        stageName: d.stage_name ?? "—",
        ownerName: resolveOwner(users, d.owner_id).name,
        updatedAt: d.updated_at,
        expectedCloseDate: d.expected_close_date ?? null,
      }));
    },
  });
}

/** Active deals whose expected close date is already in the past. */
export function useOverdueDeals() {
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["overdue-deals", tenantId, users?.length ?? 0],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<SimpleDeal[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("deals")
        .select("id,name,amount,stage_name,owner_id,updated_at,expected_close_date")
        .eq("is_won", false).eq("is_lost", false)
        .lt("expected_close_date", today)
        .order("expected_close_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: d.id, name: d.name, amount: Number(d.amount ?? 0),
        stageName: d.stage_name ?? "—",
        ownerName: resolveOwner(users, d.owner_id).name,
        updatedAt: d.updated_at,
        expectedCloseDate: d.expected_close_date ?? null,
      }));
    },
  });
}

export interface SellerRunRate {
  userId: string;
  name: string;
  assignedGoal: number;
  won: number;
  open: number;
  runRatePct: number;
  forecastPct: number;
}

/** Run rate per seller for the current month (uses get_user_run_rate). */
export function useRunRateBySeller() {
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["run-rate-by-seller", tenantId, users?.length ?? 0],
    enabled: !!tenantId && !!users?.length,
    staleTime: 60_000,
    queryFn: async (): Promise<SellerRunRate[]> => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const active = (users ?? []).filter((u) => u.isActive);
      const rows = await Promise.all(active.map(async (u) => {
        const { data } = await (supabase as any).rpc("get_user_run_rate", {
          _tenant_id: tenantId, _user_id: u.id, _year: year, _month: month,
        });
        const r = Array.isArray(data) ? data[0] : data;
        return {
          userId: u.id,
          name: u.name,
          assignedGoal: Number(r?.assigned_goal ?? 0),
          won: Number(r?.won_amount ?? 0),
          open: Number(r?.open_amount ?? 0),
          runRatePct: Number(r?.run_rate_pct ?? 0),
          forecastPct: Number(r?.forecast_pct ?? 0),
        } as SellerRunRate;
      }));
      return rows.sort((a, b) => b.won - a.won);
    },
  });
}
