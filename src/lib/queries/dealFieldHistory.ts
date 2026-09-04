import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface DealFieldChange {
  id: string;
  field: "amount" | "expected_close_date" | string;
  fromValue: string | null;
  toValue: string | null;
  description: string;
  changedAt: string;
  changedByName: string | null;
}

/** Histórico de cambios de monto y fecha de cierre de una oportunidad. */
export function useDealFieldHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal-field-history", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealFieldChange[]> => {
      const { data, error } = await (supabase as any)
        .from("activities")
        .select("id, description, occurred_at, metadata")
        .eq("deal_id", dealId!)
        .eq("type", "manual")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.metadata?.kind === "field_change")
        .map((r: any) => ({
          id: r.id,
          field: r.metadata?.field ?? "",
          fromValue: r.metadata?.from ?? null,
          toValue: r.metadata?.to ?? null,
          description: r.description,
          changedAt: r.occurred_at,
          changedByName: r.metadata?.changed_by_name ?? null,
        }));
    },
  });
}

export function useLogDealFieldChange(dealId: string | undefined) {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (args: {
      field: "amount" | "expected_close_date" | "won_at";
      from: string | null;
      to: string | null;
      description: string;
      contactId?: string | null;
    }) => {
      if (!tenantId || !dealId) return;
      const { data: auth } = await supabase.auth.getUser();
      let changedByName: string | null = null;
      if (auth.user?.id) {
        const { data: prof } = await (supabase as any)
          .from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
        changedByName = prof?.full_name ?? auth.user.email ?? null;
      }
      const { error } = await (supabase as any).from("activities").insert({
        tenant_id: tenantId,
        deal_id: dealId,
        contact_id: args.contactId ?? null,
        agent_id: auth.user?.id ?? null,
        type: "manual",
        description: args.description,
        occurred_at: new Date().toISOString(),
        metadata: {
          kind: "field_change",
          field: args.field,
          from: args.from,
          to: args.to,
          changed_by_name: changedByName,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-field-history", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activity", dealId] });
    },
  });
}
