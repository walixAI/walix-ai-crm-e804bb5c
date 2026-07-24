import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useMembers } from "@/lib/queries/team";

export interface UserPerfRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  assigned_goal: number;
  won_amount: number;
  open_amount: number;
  run_rate_pct: number;
  forecast_pct: number;
  revenue: number;
  expenses: number;
  margin_amount: number;
  margin_pct: number;
}

export function useUserRunRate(userId: string | undefined, year: number, month: number) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["user-run-rate", tenantId, userId, year, month],
    enabled: !!tenantId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_run_rate", {
        _tenant_id: tenantId!,
        _user_id: userId!,
        _year: year,
        _month: month,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        assigned_goal: number;
        won_amount: number;
        open_amount: number;
        run_rate_pct: number;
        forecast_pct: number;
      } | null;
    },
  });
}

export function useUserProfitability(userId: string | undefined, year: number, month: number) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["user-profitability", tenantId, userId, year, month],
    enabled: !!tenantId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_profitability", {
        _tenant_id: tenantId!,
        _user_id: userId!,
        _year: year,
        _month: month,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        revenue: number;
        expenses: number;
        margin_amount: number;
        margin_pct: number;
      } | null;
    },
  });
}

/** Aggregate per-user run rate + profitability for all active members. */
export function useTeamPerformance(year: number, month: number) {
  const { data: tenantId } = useTenantId();
  const { data: members = [] } = useMembers(tenantId);

  return useQuery({
    queryKey: ["team-performance", tenantId, year, month, members.map((m) => m.id).join(",")],
    enabled: !!tenantId && members.length > 0,
    queryFn: async (): Promise<UserPerfRow[]> => {
      const active = members.filter((m: any) => m.is_active);
      const results = await Promise.all(
        active.map(async (m: any) => {
          const [{ data: rr }, { data: pr }] = await Promise.all([
            supabase.rpc("get_user_run_rate", {
              _tenant_id: tenantId!, _user_id: m.id, _year: year, _month: month,
            }),
            supabase.rpc("get_user_profitability", {
              _tenant_id: tenantId!, _user_id: m.id, _year: year, _month: month,
            }),
          ]);
          const r = (rr?.[0] ?? {}) as any;
          const p = (pr?.[0] ?? {}) as any;
          return {
            user_id: m.id,
            full_name: m.full_name,
            email: m.email,
            avatar_url: m.avatar_url,
            assigned_goal: Number(r.assigned_goal ?? 0),
            won_amount: Number(r.won_amount ?? 0),
            open_amount: Number(r.open_amount ?? 0),
            run_rate_pct: Number(r.run_rate_pct ?? 0),
            forecast_pct: Number(r.forecast_pct ?? 0),
            revenue: Number(p.revenue ?? 0),
            expenses: Number(p.expenses ?? 0),
            margin_amount: Number(p.margin_amount ?? 0),
            margin_pct: Number(p.margin_pct ?? 0),
          } as UserPerfRow;
        })
      );
      return results;
    },
  });
}