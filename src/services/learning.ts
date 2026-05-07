import { supabase } from "@/integrations/supabase/client";

export interface TenantPattern {
  id: string;
  pattern_type: string;
  pattern_data: any;
  confidence_score: number;
  sample_size: number;
  updated_at: string;
}

export async function listTenantPatterns(): Promise<TenantPattern[]> {
  const { data, error } = await supabase
    .from("ai_tenant_patterns")
    .select("id, pattern_type, pattern_data, confidence_score, sample_size, updated_at")
    .order("confidence_score", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantPattern[];
}

export async function countOutcomeFeedback(): Promise<number> {
  const { count, error } = await supabase
    .from("ai_outcome_feedback")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
