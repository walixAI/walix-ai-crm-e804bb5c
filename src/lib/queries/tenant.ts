import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTenantId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tenant-id", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? null;
    },
  });
}

export interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  brandName: string | null;
  logoUrl: string | null;
  currency: string;
  locale: string;
  trialEndsAt: string | null;
}

export function useTenant() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TenantInfo | null> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, plan, brand_name, logo_url, currency, locale, trial_ends_at")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        plan: data.plan,
        brandName: data.brand_name,
        logoUrl: data.logo_url,
        currency: data.currency,
        locale: data.locale,
        trialEndsAt: data.trial_ends_at,
      };
    },
  });
}