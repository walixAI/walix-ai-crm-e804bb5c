import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformOrg {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  created_by: string;
  tenant_count: number;
  total_mrr: number;
  member_count: number;
  owner_email: string | null;
}

export function usePlatformOrgs() {
  return useQuery({
    queryKey: ["platform", "orgs"],
    staleTime: 30_000,
    queryFn: async (): Promise<PlatformOrg[]> => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, plan, created_at, created_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (orgs ?? []).map((o) => o.id);
      if (ids.length === 0) return [];

      const [{ data: tenants }, { data: members }, { data: profiles }] = await Promise.all([
        supabase.from("tenants").select("organization_id, mrr").in("organization_id", ids),
        supabase.from("organization_members").select("organization_id, user_id").in("organization_id", ids),
        supabase.from("profiles").select("id, email").in("id", (orgs ?? []).map((o) => o.created_by)),
      ]);

      const tenantStats = new Map<string, { count: number; mrr: number }>();
      (tenants ?? []).forEach((t) => {
        const cur = tenantStats.get(t.organization_id) ?? { count: 0, mrr: 0 };
        cur.count += 1;
        cur.mrr += Number(t.mrr ?? 0);
        tenantStats.set(t.organization_id, cur);
      });

      const memberCounts = new Map<string, number>();
      (members ?? []).forEach((m) => {
        memberCounts.set(m.organization_id, (memberCounts.get(m.organization_id) ?? 0) + 1);
      });

      const emails = new Map<string, string>();
      (profiles ?? []).forEach((p) => p.email && emails.set(p.id, p.email));

      return (orgs ?? []).map((o) => ({
        ...o,
        tenant_count: tenantStats.get(o.id)?.count ?? 0,
        total_mrr: tenantStats.get(o.id)?.mrr ?? 0,
        member_count: memberCounts.get(o.id) ?? 0,
        owner_email: emails.get(o.created_by) ?? null,
      }));
    },
  });
}

export function usePlatformKpis() {
  const { data: orgs = [] } = usePlatformOrgs();
  const totalOrgs = orgs.length;
  const totalTenants = orgs.reduce((s, o) => s + o.tenant_count, 0);
  const totalMrr = orgs.reduce((s, o) => s + o.total_mrr, 0);
  const totalMembers = orgs.reduce((s, o) => s + o.member_count, 0);
  return { totalOrgs, totalTenants, totalMrr, totalMembers };
}
