import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";
import { getModule, type ModuleDef } from "@/lib/marketplace/catalog";

export interface TenantModuleRow {
  id: string;
  tenant_id: string;
  module_id: string;
  pricing_model: string;
  monthly_price_mxn: number;
  status: string;
  activated_at: string;
  activated_by: string | null;
}

export function useTenantPlan() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant-plan", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("plan")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.plan ?? "starter") as string;
    },
  });
}

export function useActiveModules() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant-modules", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<TenantModuleRow[]> => {
      const { data, error } = await supabase
        .from("tenant_modules")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("activated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantModuleRow[];
    },
  });
}

export function useActivateModule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (mod: ModuleDef) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase.from("tenant_modules").insert({
        tenant_id: tenantId,
        module_id: mod.id,
        pricing_model: mod.pricingModel,
        monthly_price_mxn: mod.monthlyPriceMxn,
        status: "active",
        activated_by: user?.id ?? null,
      });
      if (error) throw error;
      // Audit log (best-effort)
      await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: user?.id,
        actor_email: user?.email,
        action: "module.activate",
        target_type: "module",
        metadata: { module_id: mod.id, name: mod.name, price: mod.monthlyPriceMxn },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-modules", tenantId] });
    },
  });
}

export function useDeactivateModule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (moduleId: string) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase
        .from("tenant_modules")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("module_id", moduleId);
      if (error) throw error;
      const mod = getModule(moduleId);
      await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: user?.id,
        actor_email: user?.email,
        action: "module.deactivate",
        target_type: "module",
        metadata: { module_id: moduleId, name: mod?.name },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-modules", tenantId] });
    },
  });
}