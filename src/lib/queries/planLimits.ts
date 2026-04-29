import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanLimit {
  plan: string;
  max_users: number;
  max_active_automations: number;
  max_pipelines: number;
  monthly_price: number;
}

export function usePlanLimits() {
  return useQuery({
    queryKey: ["plan-limits"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<string, PlanLimit>> => {
      const { data, error } = await supabase.from("plan_limits").select("*");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.plan, p as PlanLimit]));
    },
  });
}

export function usePlanLimit(plan: string | null | undefined) {
  const { data } = usePlanLimits();
  return plan ? data?.[plan] ?? null : null;
}