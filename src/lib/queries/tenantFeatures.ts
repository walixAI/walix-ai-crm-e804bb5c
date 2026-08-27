import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";

export interface TenantFeatures {
  feature_recurrences: boolean;
  feature_expenses: boolean;
  feature_deal_types: boolean;
  feature_wa_campaigns: boolean;
  track_ip: boolean;
  industry: string | null;
}

export function useTenantFeatures() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant-features", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TenantFeatures> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("feature_recurrences, feature_expenses, feature_deal_types, feature_wa_campaigns, track_ip, industry")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return {
        feature_recurrences: !!data?.feature_recurrences,
        feature_expenses: !!data?.feature_expenses,
        feature_deal_types: !!data?.feature_deal_types,
        feature_wa_campaigns: !!data?.feature_wa_campaigns,
        track_ip: data?.track_ip !== false,
        industry: data?.industry ?? null,
      };
    },
  });
}


export function useIsRefrigerationIndustry(): boolean {
  const { data } = useTenantFeatures();
  return data?.industry?.toLowerCase().includes("refriger") ?? false;
}
