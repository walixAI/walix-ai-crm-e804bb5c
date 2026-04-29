import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantSummary {
  id: string;
  name: string;
  plan: string;
  status: "active" | "suspended";
  mrr: number;
  nps: number | null;
  created_at: string;
  active_users: number;
  last_activity_at: string | null;
}

export function useAllTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    staleTime: 60_000,
    queryFn: async (): Promise<TenantSummary[]> => {
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, name, plan, status, mrr, nps, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (tenants ?? []).map((t) => t.id);
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("tenant_id, is_active, last_seen_at")
        .in("tenant_id", ids);

      const stats = new Map<string, { active: number; lastSeen: string | null }>();
      (profiles ?? []).forEach((p) => {
        const cur = stats.get(p.tenant_id ?? "") ?? { active: 0, lastSeen: null };
        if (p.is_active) cur.active += 1;
        if (p.last_seen_at && (!cur.lastSeen || p.last_seen_at > cur.lastSeen)) {
          cur.lastSeen = p.last_seen_at;
        }
        if (p.tenant_id) stats.set(p.tenant_id, cur);
      });

      return (tenants ?? []).map((t) => ({
        ...(t as TenantSummary),
        active_users: stats.get(t.id)?.active ?? 0,
        last_activity_at: stats.get(t.id)?.lastSeen ?? null,
      }));
    },
  });
}

export function useGlobalKpis() {
  const { data: tenants = [] } = useAllTenants();
  const totalTenants = tenants.length;
  const totalMrr = tenants.reduce((s, t) => s + Number(t.mrr ?? 0), 0);
  const npsValues = tenants.map((t) => t.nps).filter((n): n is number => n != null);
  const avgNps = npsValues.length
    ? Math.round(npsValues.reduce((s, n) => s + n, 0) / npsValues.length)
    : null;
  const churnTenants = tenants.filter((t) => t.status === "suspended").length;
  const churnRate = totalTenants ? (churnTenants / totalTenants) * 100 : 0;
  return { totalTenants, totalMrr, avgNps, churnRate };
}