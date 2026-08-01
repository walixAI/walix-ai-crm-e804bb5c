import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  contactInactivityDays: number;
  customerInactivityMonths: number;
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
        .select("id, name, plan, brand_name, logo_url, currency, locale, trial_ends_at, contact_inactivity_days, customer_inactivity_months")
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
        contactInactivityDays: data.contact_inactivity_days ?? 90,
        customerInactivityMonths: data.customer_inactivity_months ?? 6,
      };
    },
  });
}

export interface TenantPatch {
  name?: string;
  brand_name?: string | null;
  logo_url?: string | null;
  currency?: string;
  locale?: string;
  contact_inactivity_days?: number;
  customer_inactivity_months?: number;
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TenantPatch }) => {
      const { error } = await supabase.from("tenants").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["tenant", id] });
    },
  });
}
