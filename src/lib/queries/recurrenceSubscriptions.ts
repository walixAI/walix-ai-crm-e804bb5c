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
  status?: "active" | "paused" | "cancelled";
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export interface ContactSubscription extends RecurrenceSubscription {
  recurrence?: { name: string; period_months: number | null } | null;
  upcoming: { id: string; due_date: string; status: string }[];
}

/** Suscripciones de servicio de un contacto con sus próximas citas. */
export const useContactSubscriptions = (contactId?: string) => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["contact-subscriptions", tenant?.id, contactId],
    enabled: !!tenant?.id && !!contactId,
    queryFn: async (): Promise<ContactSubscription[]> => {
      const { data, error } = await supabase
        .from("recurrence_subscriptions")
        .select("*, recurrence:recurrence_id(name, period_months)")
        .eq("tenant_id", tenant!.id)
        .eq("contact_id", contactId!)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      const subs = (data ?? []) as any[];
      if (!subs.length) return [];
      const { data: occ } = await supabase
        .from("recurrence_occurrences")
        .select("id, subscription_id, due_date, status")
        .in("subscription_id", subs.map((s) => s.id))
        .gte("due_date", new Date().toISOString().slice(0, 10))
        .order("due_date", { ascending: true });
      return subs.map((s) => ({
        ...s,
        upcoming: (occ ?? []).filter((o: any) => o.subscription_id === s.id),
      })) as ContactSubscription[];
    },
  });
};

/** Da de baja / reactiva una suscripción de servicio. */
export const useSetSubscriptionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "active" | "paused" | "cancelled"; reason?: string }) => {
      const patch: Record<string, any> = { status: input.status };
      if (input.status === "cancelled") {
        patch.cancelled_at = new Date().toISOString();
        patch.cancel_reason = input.reason ?? null;
      } else {
        patch.cancelled_at = null;
        patch.cancel_reason = null;
      }
      const { error } = await supabase.from("recurrence_subscriptions").update(patch as any).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["recurrence-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["monthly-services"] });
    },
  });
};

export const useRecurrenceSubscriptions = (recurrenceId?: string) => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["recurrence-subscriptions", tenant?.id, recurrenceId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let q = supabase.from("recurrence_subscriptions").select("*, contacts:contact_id(name, last_name, phone)").eq("tenant_id", tenant.id);
      if (recurrenceId) q = q.eq("recurrence_id", recurrenceId);
      const { data, error } = await q.order("next_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as (RecurrenceSubscription & { contacts?: { name: string; last_name: string | null; phone: string | null } | null })[];
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
