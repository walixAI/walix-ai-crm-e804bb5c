import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrgTenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  mrr: number;
  trial_ends_at: string | null;
  created_at: string;
  active_users: number;
  last_activity_at: string | null;
  logo_url?: string | null;
}

export interface OrgPlanLimit {
  plan: string;
  max_tenants: number;
  monthly_price: number;
}

/** Tenants de una organización con stats de uso. */
export function useOrgTenants(orgId: string | undefined | null) {
  return useQuery({
    queryKey: ["org", orgId, "tenants"],
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<OrgTenant[]> => {
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, name, plan, status, mrr, trial_ends_at, created_at, logo_url")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
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
        ...(t as OrgTenant),
        active_users: stats.get(t.id)?.active ?? 0,
        last_activity_at: stats.get(t.id)?.lastSeen ?? null,
      }));
    },
  });
}

/** Tenants accesibles para el usuario logueado (todos sus tenants). */
export function useUserTenants() {
  const { user, organizations } = useAuth();
  const orgIds = organizations.map((o) => o.organization_id);

  return useQuery({
    queryKey: ["user", user?.id, "tenants", orgIds],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      // Tenants vía membresía de organización
      let orgTenants: { id: string; name: string; plan: string; organization_id: string; logo_url?: string | null }[] = [];
      if (orgIds.length > 0) {
        const { data } = await supabase
          .from("tenants")
          .select("id, name, plan, organization_id, logo_url")
          .in("organization_id", orgIds);
        orgTenants = data ?? [];
      }

      // Tenants vía user_roles (vendedor/manager invitado a un tenant)
      const { data: roleTenants } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .not("tenant_id", "is", null);
      const extraIds = (roleTenants ?? [])
        .map((r) => r.tenant_id as string)
        .filter((id) => id && !orgTenants.some((t) => t.id === id));

      if (extraIds.length > 0) {
        const { data } = await supabase
          .from("tenants")
          .select("id, name, plan, organization_id, logo_url")
          .in("id", extraIds);
        orgTenants = [...orgTenants, ...(data ?? [])];
      }

      return orgTenants;
    },
  });
}

export function useOrgPlanLimits() {
  return useQuery({
    queryKey: ["org_plan_limits"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OrgPlanLimit[]> => {
      const { data, error } = await supabase
        .from("org_plan_limits")
        .select("plan, max_tenants, monthly_price")
        .order("max_tenants", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrganization(orgId: string | undefined | null) {
  return useQuery({
    queryKey: ["organization", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, plan, created_at")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
