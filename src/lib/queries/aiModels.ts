import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiModelCatalogEntry {
  id: string;
  vendor: string;
  model_id: string;
  commercial_name: string;
  credit_factor: number;
  is_active: boolean;
  sort_order: number;
}

export interface CreditBalance {
  whatsapp_included: number;
  whatsapp_purchased: number;
  whatsapp_used: number;
  ai_included: number;
  ai_purchased: number;
  ai_used: number;
  period_start: string;
}

export function useAiModelCatalog() {
  return useQuery({
    queryKey: ["ai-model-catalog"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AiModelCatalogEntry[]> => {
      const { data, error } = await supabase
        .from("ai_model_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as AiModelCatalogEntry[];
    },
  });
}

/** Saldo de créditos del periodo actual (fallback a los incluidos del plan). */
export function useCreditBalance(tenantId?: string) {
  return useQuery({
    queryKey: ["credit-balance", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<CreditBalance | null> => {
      const start = new Date();
      const period = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("tenant_credit_balances")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("period_start", period)
        .maybeSingle();
      if (error) throw error;
      return (data as CreditBalance) ?? null;
    },
  });
}

export interface ModelChangeRequest {
  id: string;
  tenant_id: string;
  requested_vendor: string;
  requested_model: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  review_note: string | null;
}

export function useModelChangeRequests(tenantId?: string) {
  return useQuery({
    queryKey: ["ai-model-requests", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ModelChangeRequest[]> => {
      const { data, error } = await supabase
        .from("ai_model_change_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as ModelChangeRequest[];
    },
  });
}

export function useRequestModelChange(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { vendor: string; reason: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("ai_model_change_requests").insert({
        tenant_id: tenantId!,
        requested_vendor: payload.vendor,
        reason: payload.reason,
        requested_by: u.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-model-requests", tenantId] }),
  });
}

/** Vista de plataforma: todas las instancias con su motor de IA. */
export interface PlatformTenantAi {
  id: string;
  name: string;
  plan: string;
  mrr: number;
  ai_vendor: string | null;
  ai_model: string | null;
}

export function usePlatformTenantsAi() {
  return useQuery({
    queryKey: ["platform", "tenants-ai"],
    staleTime: 30_000,
    queryFn: async (): Promise<PlatformTenantAi[]> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, plan, mrr, ai_vendor, ai_model")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PlatformTenantAi[];
    },
  });
}

export function useSetTenantModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { tenantId: string; vendor: string; model: string }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ ai_vendor: p.vendor, ai_model: p.model } as never)
        .eq("id", p.tenantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "tenants-ai"] }),
  });
}
