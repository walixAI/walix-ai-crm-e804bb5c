import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";

export interface DealType {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  position: number;
  is_active: boolean;
}

export function useDealTypes() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["deal-types", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_types")
        .select("id, tenant_id, key, label, position, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DealType[];
    },
  });
}

export function useDealTypeOptions() {
  const { data = [] } = useDealTypes();
  return data.map((d) => ({ value: d.key, label: d.label }));
}

export function useDealTypeLabel(key?: string | null) {
  const { data = [] } = useDealTypes();
  return data.find((d) => d.key === key)?.label ?? (key === "venta" ? "Venta" : key ?? "—");
}

export function useActiveDealTypeKeys(): string[] {
  const { data = [] } = useDealTypes();
  return data.map((d) => d.key);
}
