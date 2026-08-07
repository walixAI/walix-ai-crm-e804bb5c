import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./tenant";

export type RecurrenceKind = "periodic" | "calendar";

export interface RecurrenceAction {
  type: "create_task" | "create_deal" | "send_whatsapp" | "notify_owner";
  config?: Record<string, any>;
}

export interface RecurrenceDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  kind: RecurrenceKind;
  period_months: number | null;
  anticipation_days: number;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  actions: RecurrenceAction[];
  substitution_rule: Record<string, any>;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

export const useRecurrences = () => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["recurrences", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RecurrenceDefinition[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<RecurrenceDefinition>) => {
      const payload = { ...input, tenant_id: tenant?.id } as any;
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RecurrenceDefinition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};

export const useUpdateRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<RecurrenceDefinition> & { id: string }) => {
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .update(rest as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RecurrenceDefinition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};

export const useDeleteRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurrence_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};

// ---------------------------------------------------------------------------
// Ciclo de servicio recurrente ligado a una oportunidad
// ---------------------------------------------------------------------------

export interface DealRecurrence {
  occurrenceId: string;
  subscriptionId: string;
  serviceName: string;
  periodMonths: number;
  dueDate: string;
  status: string;
  nextDates: string[];
}

export function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatServiceMonths(dates: string[]) {
  return dates.map(monthLabel).join(" y ");
}

/** Ocurrencia recurrente ligada a una oportunidad (si existe) + próximas citas. */
export function useDealRecurrence(dealId?: string) {
  return useQuery({
    queryKey: ["deal-recurrence", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealRecurrence | null> => {
      const { data: occ } = await supabase
        .from("recurrence_occurrences")
        .select("id, subscription_id, due_date, status, recurrence:recurrence_id(name, period_months)")
        .eq("generated_deal_id", dealId!)
        .order("due_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!occ) return null;

      const today = new Date().toISOString().slice(0, 10);
      const { data: next } = await supabase
        .from("recurrence_occurrences")
        .select("due_date")
        .eq("subscription_id", occ.subscription_id)
        .gt("due_date", today)
        .neq("status", "skipped")
        .order("due_date", { ascending: true })
        .limit(3);

      const rec = (occ as any).recurrence;
      return {
        occurrenceId: occ.id,
        subscriptionId: occ.subscription_id!,
        serviceName: rec?.name ?? "Servicio recurrente",
        periodMonths: rec?.period_months ?? 6,
        dueDate: occ.due_date,
        status: occ.status,
        nextDates: (next ?? []).map((n: any) => n.due_date),
      };
    },
  });
}

/** Cierra el ciclo del servicio y programa las siguientes citas. */
export function useCloseRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.rpc("close_recurrence_from_deal" as any, { _deal_id: dealId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-recurrence"] });
      qc.invalidateQueries({ queryKey: ["monthly-services"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    },
  });
}

/** Próximas citas programadas del servicio de una oportunidad. */
export async function fetchNextServiceDates(dealId: string): Promise<string[]> {
  const { data: occ } = await supabase
    .from("recurrence_occurrences")
    .select("subscription_id")
    .eq("generated_deal_id", dealId)
    .order("due_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!occ?.subscription_id) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("recurrence_occurrences")
    .select("due_date")
    .eq("subscription_id", occ.subscription_id)
    .gt("due_date", today)
    .neq("status", "skipped")
    .order("due_date", { ascending: true })
    .limit(2);
  return (data ?? []).map((d: any) => d.due_date);
}
