import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealRecurrence {
  occurrenceId: string;
  subscriptionId: string;
  serviceName: string;
  periodMonths: number;
  dueDate: string;
  status: string;
  nextDates: string[];
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
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
        subscriptionId: occ.subscription_id,
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
      const { data, error } = await supabase.rpc("close_recurrence_from_deal", { _deal_id: dealId });
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

/** Próximas citas de un servicio recurrente, tras ganar la oportunidad. */
export async function fetchNextServiceDates(dealId: string): Promise<string[]> {
  const { data: occ } = await supabase
    .from("recurrence_occurrences")
    .select("subscription_id")
    .eq("generated_deal_id", dealId)
    .order("due_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!occ) return [];
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