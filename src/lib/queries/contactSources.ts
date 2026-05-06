import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface ContactSource {
  id: string;
  name: string;
  icon: string | null;
  position: number;
}

const TABLE = "contact_sources";

export function useContactSources() {
  return useQuery({
    queryKey: ["contact-sources"],
    queryFn: async (): Promise<ContactSource[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useUpsertSource() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ContactSource> & { id?: string; name: string }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const payload: any = {
        tenant_id: tenantId,
        name: input.name,
        icon: input.icon ?? null,
        position: input.position ?? 0,
      };
      if (input.id) {
        const { error } = await (supabase as any).from(TABLE).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(TABLE).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-sources"] }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-sources"] }),
  });
}