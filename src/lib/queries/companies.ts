import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

const TABLE = "companies";

export function useCompanies(search?: string) {
  return useQuery({
    queryKey: ["companies", search ?? ""],
    queryFn: async (): Promise<Company[]> => {
      let q = (supabase as any).from(TABLE).select("*").order("name", { ascending: true }).limit(50);
      if (search && search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCompany(id: string | null | undefined) {
  return useQuery({
    queryKey: ["company", id],
    enabled: !!id,
    queryFn: async (): Promise<Company | null> => {
      const { data, error } = await (supabase as any).from(TABLE).select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCompany() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Company> & { name: string }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ tenant_id: tenantId, ...input })
        .select("*")
        .single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Company> }) => {
      const { error } = await (supabase as any).from(TABLE).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", id] });
    },
  });
}