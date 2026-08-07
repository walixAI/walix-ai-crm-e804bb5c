import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export type GoalDimension = "global" | "deal_type" | "pipeline" | "product_category";
export type GoalMetric = "amount" | "count";

export interface MonthlyGoal {
  id: string;
  tenant_id: string;
  period_year: number;
  period_month: number;
  amount: number;
  currency: string;
  metric: GoalMetric;
  dimension: GoalDimension;
  dimension_value_text: string | null;
  dimension_value_uuid: string | null;
  notes: string | null;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalAssignment {
  id: string;
  goal_id: string;
  tenant_id: string;
  user_id: string;
  share_percent: number;
  amount: number;
}

export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  position: number;
}

export function useMonthlyGoals(year: number, month: number) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["monthly-goals", tenantId, year, month],
    enabled: !!tenantId,
    queryFn: async (): Promise<MonthlyGoal[]> => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("period_year", year)
        .eq("period_month", month)
        .order("dimension", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MonthlyGoal[];
    },
  });
}

export function useGoalAssignments(goalId: string | null | undefined) {
  return useQuery({
    queryKey: ["monthly-goal-assignments", goalId],
    enabled: !!goalId,
    queryFn: async (): Promise<GoalAssignment[]> => {
      const { data, error } = await supabase
        .from("monthly_goal_assignments")
        .select("*")
        .eq("goal_id", goalId!);
      if (error) throw error;
      return (data ?? []) as GoalAssignment[];
    },
  });
}

export function useProductCategories() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["product-categories", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ProductCategory[]> => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
  });
}

export function useCreateProductCategory() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("product_categories")
        .insert({ tenant_id: tenantId!, name });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-categories", tenantId] }),
  });
}

export function useDeleteProductCategory() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-categories", tenantId] }),
  });
}

/**
 * Suggest split percentages based on last 3 months of won deals in that dimension.
 */
export async function suggestGoalSplit(params: {
  tenantId: string;
  dimension: GoalDimension;
  dimensionValueText: string | null;
  dimensionValueUuid: string | null;
  userIds: string[];
}): Promise<Array<{ user_id: string; share_percent: number }>> {
  const { data, error } = await supabase.rpc("suggest_goal_split", {
    _tenant_id: params.tenantId,
    _dimension: params.dimension,
    _dimension_value_text: params.dimensionValueText,
    _dimension_value_uuid: params.dimensionValueUuid,
    _user_ids: params.userIds,
  });
  if (error) throw error;
  return (data ?? []) as Array<{ user_id: string; share_percent: number }>;
}

export interface SaveGoalInput {
  id?: string;
  year: number;
  month: number;
  amount: number;
  dimension: GoalDimension;
  metric: GoalMetric;
  dimensionValueText: string | null;
  dimensionValueUuid: string | null;
  notes?: string | null;
  isDraft: boolean;
  assignments: Array<{ user_id: string; share_percent: number }>;
}

export function useSaveMonthlyGoal() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: SaveGoalInput) => {
      if (!tenantId) throw new Error("Sin tenant");

      // 1. Upsert the goal
      const basePayload = {
        tenant_id: tenantId,
        period_year: input.year,
        period_month: input.month,
        amount: input.amount,
        metric: input.metric,
        dimension: input.dimension,
        dimension_value_text: input.dimensionValueText,
        dimension_value_uuid: input.dimensionValueUuid,
        notes: input.notes ?? null,
        is_draft: input.isDraft,
      };

      let goalId = input.id;
      if (goalId) {
        const { error } = await supabase.from("monthly_goals").update(basePayload).eq("id", goalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("monthly_goals").insert(basePayload).select("id").single();
        if (error) throw error;
        goalId = data.id;
      }

      // 2. Replace assignments (delete then insert)
      const { error: delErr } = await supabase.from("monthly_goal_assignments").delete().eq("goal_id", goalId!);
      if (delErr) throw delErr;

      if (input.assignments.length > 0) {
        const rows = input.assignments.map((a) => ({
          goal_id: goalId!,
          tenant_id: tenantId,
          user_id: a.user_id,
          share_percent: a.share_percent,
        }));
        const { error: insErr } = await supabase.from("monthly_goal_assignments").insert(rows);
        if (insErr) throw insErr;
      }
      return goalId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-goals"] });
      qc.invalidateQueries({ queryKey: ["monthly-goal-assignments"] });
      qc.invalidateQueries({ queryKey: ["team-performance"] });
    },
  });
}

export function useDeleteMonthlyGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-goals"] });
      qc.invalidateQueries({ queryKey: ["team-performance"] });
    },
  });
}