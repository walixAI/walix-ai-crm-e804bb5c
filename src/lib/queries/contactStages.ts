import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface ContactStage {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isWon: boolean;
  isLost: boolean;
}

const TABLE = "contact_stages";

export function useContactStages() {
  return useQuery({
    queryKey: ["contact-stages"],
    queryFn: async (): Promise<ContactStage[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id, name: s.name, color: s.color, position: s.position,
        isDefault: s.is_default, isWon: s.is_won, isLost: s.is_lost,
      }));
    },
    staleTime: 60_000,
  });
}

export function useUpsertStage() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ContactStage> & { id?: string; name: string }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const payload: any = {
        tenant_id: tenantId,
        name: input.name,
        color: input.color ?? "hsl(220 13% 65%)",
        position: input.position ?? 0,
        is_default: input.isDefault ?? false,
        is_won: input.isWon ?? false,
        is_lost: input.isLost ?? false,
      };
      if (input.id) {
        const { error } = await (supabase as any).from(TABLE).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(TABLE).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-stages"] }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-stages"] }),
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: { id: string; position: number }[]) => {
      for (const o of ordered) {
        const { error } = await (supabase as any).from(TABLE).update({ position: o.position }).eq("id", o.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-stages"] }),
  });
}