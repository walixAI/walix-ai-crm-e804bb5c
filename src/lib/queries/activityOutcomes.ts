import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

/** Tipo de actividad con dirección combinada. */
export interface ActivityKind {
  value: string;
  label: string;
  /** enum activity_type usado en la tabla activities */
  base: string;
  direction: "in" | "out" | "none";
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  { value: "llamada_saliente", label: "Llamada saliente", base: "call", direction: "out" },
  { value: "llamada_entrante", label: "Llamada entrante", base: "call", direction: "in" },
  { value: "whatsapp_saliente", label: "WhatsApp saliente", base: "wa_sent", direction: "out" },
  { value: "whatsapp_entrante", label: "WhatsApp entrante", base: "wa_received", direction: "in" },
  { value: "email_saliente", label: "Email saliente", base: "email", direction: "out" },
  { value: "email_entrante", label: "Email entrante", base: "email", direction: "in" },
  { value: "visita_saliente", label: "Visita / reunión (nosotros)", base: "meeting", direction: "out" },
  { value: "visita_entrante", label: "Visita del cliente", base: "meeting", direction: "in" },
  { value: "otro", label: "Otro", base: "manual", direction: "none" },
];

export function activityKind(value: string | null | undefined): ActivityKind | undefined {
  return ACTIVITY_KINDS.find((k) => k.value === value);
}

export interface ActivityOutcome {
  id: string;
  pipelineId: string | null;
  stageId: string | null;
  activityKind: string | null;
  label: string;
  movesToStageId: string | null;
  requiresNextAction: boolean;
  position: number;
  isActive: boolean;
}

function mapOutcome(r: any): ActivityOutcome {
  return {
    id: r.id,
    pipelineId: r.pipeline_id,
    stageId: r.stage_id,
    activityKind: r.activity_kind,
    label: r.label,
    movesToStageId: r.moves_to_stage_id,
    requiresNextAction: r.requires_next_action,
    position: r.position,
    isActive: r.is_active,
  };
}

/** Todas las tipificaciones del tenant (opcionalmente de un pipeline). */
export function useActivityOutcomes(pipelineId?: string | null) {
  return useQuery({
    queryKey: ["activity-outcomes", pipelineId ?? "all"],
    queryFn: async (): Promise<ActivityOutcome[]> => {
      let q = (supabase as any)
        .from("activity_outcomes")
        .select("*")
        .order("position", { ascending: true });
      if (pipelineId) q = q.eq("pipeline_id", pipelineId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapOutcome);
    },
  });
}

/** Tipificaciones aplicables a una etapa + tipo de actividad. */
export function filterOutcomes(
  all: ActivityOutcome[],
  stageId: string | null | undefined,
  kind: string | null | undefined,
) {
  return all
    .filter((o) => o.isActive)
    .filter((o) => !o.stageId || o.stageId === stageId)
    .filter((o) => !o.activityKind || o.activityKind === kind)
    .sort((a, b) => a.position - b.position);
}

export interface LogFollowUpInput {
  contactId: string | null;
  dealId: string | null;
  stageId: string | null;
  kind: string;
  outcome: ActivityOutcome | null;
  description: string;
  occurredAt: string;
  /** null = el usuario indicó que no habrá siguiente acción */
  nextActionAt: string | null;
  nextActionTitle?: string;
  /** etapa destino confirmada por el usuario (puede diferir de la sugerida) */
  moveToStageId?: string | null;
}

export function useLogFollowUp() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: LogFollowUpInput) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const k = activityKind(input.kind);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const { error } = await (supabase as any).from("activities").insert({
        tenant_id: tenantId,
        contact_id: input.contactId,
        deal_id: input.dealId,
        agent_id: userId,
        type: (k?.base ?? "manual") as any,
        description: input.description,
        occurred_at: input.occurredAt,
        metadata: {
          activity_kind: input.kind,
          activity_kind_label: k?.label ?? input.kind,
          direction: k?.direction ?? "none",
          outcome_id: input.outcome?.id ?? null,
          result: input.outcome?.label ?? null,
          next_action_at: input.nextActionAt,
          follow_up: true,
        },
      });
      if (error) throw error;

      // Mover etapa si aplica
      const targetStageId = input.moveToStageId ?? null;
      if (input.dealId && targetStageId && targetStageId !== input.stageId) {
        const { data: stage } = await (supabase as any)
          .from("pipeline_stages")
          .select("id, name, is_won, is_lost")
          .eq("id", targetStageId)
          .maybeSingle();
        if (stage) {
          await (supabase as any).from("deals").update({
            stage_id: stage.id,
            stage_name: stage.name,
            is_won: !!stage.is_won,
            is_lost: !!stage.is_lost,
          }).eq("id", input.dealId);
        }
      }

      // Próxima acción → tarea
      if (input.nextActionAt) {
        await (supabase as any).from("tasks").insert({
          tenant_id: tenantId,
          contact_id: input.contactId,
          deal_id: input.dealId,
          assignee_id: userId,
          title: input.nextActionTitle?.trim() || `Seguimiento: ${input.outcome?.label ?? "próximo contacto"}`,
          due_at: input.nextActionAt,
        });
      }

      if (input.contactId) {
        await supabase
          .from("contacts")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", input.contactId);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["contact-activity", v.contactId] });
      qc.invalidateQueries({ queryKey: ["contact", v.contactId] });
      qc.invalidateQueries({ queryKey: ["deal-activity", v.dealId] });
      qc.invalidateQueries({ queryKey: ["stage-history", v.dealId] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["contact-tasks", v.contactId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/* ---------- Configuración por tenant ---------- */

export function useUpsertActivityOutcome() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<ActivityOutcome> & { id?: string; pipelineId: string | null }) => {
      const row: any = {
        pipeline_id: input.pipelineId,
        stage_id: input.stageId ?? null,
        activity_kind: input.activityKind ?? null,
        label: input.label,
        moves_to_stage_id: input.movesToStageId ?? null,
        requires_next_action: input.requiresNextAction ?? true,
        position: input.position ?? 0,
        is_active: input.isActive ?? true,
      };
      if (input.id) {
        const { error } = await (supabase as any).from("activity_outcomes").update(row).eq("id", input.id);
        if (error) throw error;
      } else {
        if (!tenantId) throw new Error("No hay tenant activo");
        const { error } = await (supabase as any)
          .from("activity_outcomes")
          .insert({ ...row, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-outcomes"] }),
  });
}

export function useDeleteActivityOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("activity_outcomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-outcomes"] }),
  });
}

export function useSeedActivityOutcomes() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { error } = await (supabase as any).rpc("seed_default_activity_outcomes", {
        _tenant_id: tenantId,
        _pipeline_id: pipelineId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-outcomes"] }),
  });
}