import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./tenant";

export type ServiceStatus =
  | "pending"
  | "price_accepted"
  | "scheduled"
  | "executed"
  | "postponed"
  | "skipped"
  | "lost";

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  pending: "Por contactar",
  price_accepted: "Precio aceptado",
  scheduled: "Agendado",
  executed: "Ejecutado",
  postponed: "Pospuesto",
  skipped: "No procede",
  lost: "No cerrado (sigue la suscripción)",
};

export interface MonthlyService {
  id: string;
  tenant_id: string;
  recurrence_id: string;
  subscription_id: string;
  due_date: string;
  status: ServiceStatus;
  scheduled_at: string | null;
  price_quoted: number | null;
  price_accepted_at: string | null;
  executed_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  generated_deal_id: string | null;
  generated_task_id: string | null;
  recurrence?: { name: string; period_months: number | null } | null;
  subscription?: { contact_id: string | null } | null;
  contact?: { id: string; name: string; phone: string | null; owner_id: string | null } | null;
}

/** Devuelve "YYYY-MM-01" del mes indicado (0 = mes actual). */
export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

export const useMonthlyServices = (month: string) => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["monthly-services", tenant?.id, month],
    queryFn: async () => {
      if (!tenant?.id) return [] as MonthlyService[];
      const start = month;
      const d = new Date(month + "T00:00:00");
      d.setMonth(d.getMonth() + 1);
      const end = monthKey(d);

      const { data, error } = await supabase
        .from("recurrence_occurrences")
        .select(
          "*, recurrence:recurrence_id(name, period_months), subscription:subscription_id(contact_id)",
        )
        .eq("tenant_id", tenant.id)
        .gte("due_date", start)
        .lt("due_date", end)
        .order("status", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const contactIds = [
        ...new Set(rows.map((r) => r.subscription?.contact_id).filter(Boolean)),
      ] as string[];
      let contactMap: Record<string, any> = {};
      if (contactIds.length) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, phone, owner_id")
          .in("id", contactIds);
        contactMap = Object.fromEntries((contacts ?? []).map((c) => [c.id, c]));
      }
      return rows.map((r) => ({
        ...r,
        contact: contactMap[r.subscription?.contact_id] ?? null,
      })) as MonthlyService[];
    },
    enabled: !!tenant?.id,
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<MonthlyService>) => {
      const { error } = await supabase
        .from("recurrence_occurrences")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-services"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
};

/** Oportunidades generadas por las recurrencias del mes indicado (para filtrar el Pipeline). */
export const useMonthServiceDeals = (month: string) => {
  const { data: services = [] } = useMonthlyServices(month);
  const dealIds = new Set(
    services.map((s) => s.generated_deal_id).filter(Boolean) as string[],
  );
  const contactIds = new Set(
    services.map((s) => s.contact?.id).filter(Boolean) as string[],
  );
  return { services, dealIds, contactIds };
};

/** Etapas del pipeline de servicio, por nombre. */
const stageForStatus: Record<ServiceStatus, string | null> = {
  pending: "Solicitud",
  price_accepted: "Solicitud",
  scheduled: "Agendado",
  executed: "Completado",
  postponed: null,
  skipped: null,
  lost: null,
};

async function findStageId(dealId: string, stageName: string) {
  const { data: deal } = await supabase
    .from("deals")
    .select("id, stage_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal?.stage_id) return null;
  const { data: current } = await supabase
    .from("pipeline_stages")
    .select("pipeline_id")
    .eq("id", deal.stage_id)
    .maybeSingle();
  if (!current?.pipeline_id) return null;
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("pipeline_id", current.pipeline_id)
    .eq("name", stageName)
    .maybeSingle();
  return stage ?? null;
}

/**
 * Cambia el estado de un servicio del mes y sincroniza la oportunidad,
 * la tarea de seguimiento y el siguiente ciclo de la suscripción.
 */
export const useServiceTransition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      service: MonthlyService;
      status: ServiceStatus;
      scheduled_at?: string | null;
      price_quoted?: number | null;
      notes?: string | null;
      postponed_to?: string | null;
    }) => {
      const { service, status } = input;
      const now = new Date().toISOString();
      const patch: Record<string, any> = { status };
      if (input.scheduled_at !== undefined) patch.scheduled_at = input.scheduled_at;
      if (input.price_quoted !== undefined) patch.price_quoted = input.price_quoted;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (status === "price_accepted") patch.price_accepted_at = now;
      if (status === "executed") patch.executed_at = now;

      const { error } = await supabase
        .from("recurrence_occurrences")
        .update(patch as any)
        .eq("id", service.id);
      if (error) throw error;

      // Oportunidad vinculada
      const stageName = stageForStatus[status];
      if (service.generated_deal_id && stageName) {
        const stage = await findStageId(service.generated_deal_id, stageName);
        const dealPatch: Record<string, any> = {};
        if (stage) {
          dealPatch.stage_id = stage.id;
          dealPatch.stage_name = stage.name;
        }
        if (input.price_quoted != null) dealPatch.amount = input.price_quoted;
        if (input.scheduled_at) dealPatch.expected_close_date = input.scheduled_at.slice(0, 10);
        if (Object.keys(dealPatch).length) {
          await supabase.from("deals").update(dealPatch as any).eq("id", service.generated_deal_id);
        }
      }

      // Cerrar la tarea de seguimiento cuando ya se agendó o ejecutó
      if (service.generated_task_id && (status === "scheduled" || status === "executed" || status === "skipped")) {
        await supabase
          .from("tasks")
          .update({ completed: true, completed_at: now } as any)
          .eq("id", service.generated_task_id);
      }

      // Siguiente ciclo
      if (status === "executed") {
        const period = service.recurrence?.period_months ?? 6;
        const next = new Date(service.due_date + "T00:00:00");
        next.setMonth(next.getMonth() + period);
        await supabase
          .from("recurrence_subscriptions")
          .update({ last_executed_date: service.due_date, next_due_date: monthKey(next) })
          .eq("id", service.subscription_id);
      }
      if (status === "postponed" && input.postponed_to) {
        await supabase
          .from("recurrence_subscriptions")
          .update({ next_due_date: input.postponed_to })
          .eq("id", service.subscription_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-services"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
};
