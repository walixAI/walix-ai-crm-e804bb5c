import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface DealNote {
  id: string;
  description: string;
  occurredAt: string;
  createdAt: string;
}

export function useDealNotes(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal-notes", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealNote[]> => {
      const { data, error } = await (supabase as any)
        .from("activities")
        .select("id, description, occurred_at, created_at")
        .eq("deal_id", dealId!)
        .eq("type", "note")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        description: r.description,
        occurredAt: r.occurred_at,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useCreateDealNote(dealId: string | undefined, contactId?: string | null) {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (description: string) => {
      if (!tenantId || !dealId) throw new Error("Tenant u oportunidad no disponible");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("activities").insert({
        tenant_id: tenantId,
        deal_id: dealId,
        contact_id: contactId ?? null,
        agent_id: auth.user?.id ?? null,
        type: "note",
        description,
        occurred_at: new Date().toISOString(),
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-notes", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activity", dealId] });
    },
  });
}

export function useUpdateDealNote(dealId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; description: string }) => {
      const { error } = await (supabase as any)
        .from("activities")
        .update({ description: args.description })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-notes", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activity", dealId] });
    },
  });
}

export function useDeleteDealNote(dealId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-notes", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activity", dealId] });
    },
  });
}