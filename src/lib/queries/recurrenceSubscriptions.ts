import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./tenant";

export interface RecurrenceSubscription {
  id: string;
  tenant_id: string;
  recurrence_id: string;
  contact_id: string | null;
  entity_type: "contact" | "deal" | "equipment";
  entity_id: string;
  next_due_date: string;
  last_executed_date: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const useRecurrenceSubscriptions = (recurrenceId?: string) => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["recurrence-subscriptions", tenant?.id, recurrenceId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let q = supabase.from("recurrence_subscriptions").select("*, contact:contact_id(full_name, phone)").eq("tenant_id", tenant.id);
      if (recurrenceId) q = q.eq("recurrence_id", recurrenceId);
      const { data, error } = await q.order("next_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (RecurrenceSubscription & { contact?: { full_name: string; phone: string } | null })[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateRecurrenceSubscription = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<RecurrenceSubscription>) => {
      const { data, error } = await supabase
        .from("recurrence_subscriptions")
        .insert({ ...input, tenant_id: tenant?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RecurrenceSubscription;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrence-subscriptions", tenant?.id] }),
  });
};

export const useDeleteRecurrenceSubscription = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurrence_subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrence-subscriptions", tenant?.id] }),
  });
};
