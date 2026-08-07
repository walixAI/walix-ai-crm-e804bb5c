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
  /** advance = mueve solo · suggest = propone y el usuario confirma · stay = no mueve */
  stageBehavior: StageBehavior;
  /** cierra la oportunidad como ganada */
  isWon: boolean;
  /** cierra la oportunidad como perdida */
  isLost: boolean;
}

export type StageBehavior = "advance" | "suggest" | "stay";

export const STAGE_BEHAVIORS: { value: StageBehavior; label: string; hint: string }[] = [
  { value: "advance", label: "Avanza solo", hint: "Mueve la oportunidad automáticamente" },
  { value: "suggest", label: "Sugiere", hint: "Propone la etapa y el usuario confirma" },
  { value: "stay", label: "Permanece", hint: "No cambia la etapa" },
];

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
    stageBehavior: (r.stage_behavior ?? "stay") as StageBehavior,
    isWon: !!r.is_won,
    isLost: !!r.is_lost,
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
    // Sin etapa (p. ej. seguimiento sin oportunidad) se muestran todas las opciones.
    .filter((o) => !stageId || !o.stageId || o.stageId === stageId)
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
  /* --- Diagnóstico de avance --- */
  /** bloqueo declarado por el lead (sigue vivo). "" o null = sin cambio */
  blockerId?: string | null;
  blockerExpectedAt?: string | null;
  blockerNote?: string | null;
  /** marcar el bloqueo vigente como resuelto */
  clearBlocker?: boolean;
  /** motivo de pérdida (lead terminal) */
  lossReasonId?: string | null;
  /** etiquetas legibles para el histórico */
  blockerLabel?: string | null;
  lossReasonLabel?: string | null;
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
          blocker_id: input.blockerId ?? null,
          blocker_label: input.blockerLabel ?? null,
          blocker_expected_at: input.blockerExpectedAt ?? null,
          blocker_note: input.blockerNote ?? null,
          blocker_cleared: !!input.clearBlocker,
          loss_reason_id: input.lossReasonId ?? null,
          loss_reason_label: input.lossReasonLabel ?? null,
        },
      });
      if (error) throw error;

      // Estado vigente de diagnóstico en la oportunidad
      if (input.dealId) {
        const patch: Record<string, any> = {};
        if (input.clearBlocker) {
          patch.current_blocker_id = null;
          patch.blocker_set_at = null;
          patch.blocker_expected_at = null;
          patch.blocker_note = null;
        }
        if (input.blockerId) {
          patch.current_blocker_id = input.blockerId;
          patch.blocker_set_at = new Date().toISOString();
          patch.blocker_expected_at = input.blockerExpectedAt ?? null;
          patch.blocker_note = input.blockerNote ?? null;
          patch.last_known_blocker_id = input.blockerId;
        }
        if (input.lossReasonId) {
          patch.loss_reason_id = input.lossReasonId;
          patch.is_lost = true;
          patch.lost_reason = input.lossReasonLabel ?? null;
        }
        // Tipificación terminal: cierra la oportunidad
        if (input.outcome?.isWon) {
          patch.is_won = true;
          patch.is_lost = false;
        }
        if (input.outcome?.isLost) {
          patch.is_lost = true;
          patch.is_won = false;
        }
        // Una actividad entrante significa que el cliente sí respondió
        if (k?.direction === "in") {
          patch.last_inbound_at = input.occurredAt;
          patch.no_response_since = null;
        }
        if (Object.keys(patch).length) {
          await (supabase as any).from("deals").update(patch).eq("id", input.dealId);
        }
      }

      // Mover etapa si aplica
      const targetStageId = input.moveToStageId ?? null;
      if (input.dealId && targetStageId && targetStageId !== input.stageId) {
        const { data: stage } = await (supabase as any)
          .from("pipeline_stages")
          .select("id, name, is_won, is_lost, position")
          .eq("id", targetStageId)
          .maybeSingle();
        let allowed = !!stage;
        // No se permiten retrocesos: la etapa destino debe ir adelante de la actual.
        if (stage && input.stageId) {
          const { data: current } = await (supabase as any)
            .from("pipeline_stages")
            .select("position")
            .eq("id", input.stageId)
            .maybeSingle();
          if (current && stage.position <= current.position) allowed = false;
        }
        if (stage && allowed) {
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
      qc.invalidateQueries({ queryKey: ["deal-diagnostic", v.dealId] });
      qc.invalidateQueries({ queryKey: ["diagnostics-deals"] });
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
        stage_behavior: input.stageBehavior ?? "stay",
        is_won: input.isWon ?? false,
        is_lost: input.isLost ?? false,
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