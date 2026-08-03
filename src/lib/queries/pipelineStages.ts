import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageImpact {
  dealsCount: number;
  outcomesCount: number;
  outcomesTargetingCount: number;
  rulesCount: number;
}

/** Conteo de dependencias de una etapa (deals, tipificaciones, reglas). */
export function useStageImpact(stageId: string | null) {
  return useQuery({
    queryKey: ["stage-impact", stageId],
    enabled: !!stageId,
    queryFn: async (): Promise<StageImpact> => {
      const { data, error } = await (supabase as any).rpc("pipeline_stage_impact", {
        _stage_id: stageId,
      });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      return {
        dealsCount: r?.deals_count ?? 0,
        outcomesCount: r?.outcomes_count ?? 0,
        outcomesTargetingCount: r?.outcomes_targeting_count ?? 0,
        rulesCount: r?.rules_count ?? 0,
      };
    },
  });
}

export type OutcomeAction = "move" | "generalize" | "delete";

export interface DeleteStageResult {
  deals_moved: number;
  outcomes_affected: number;
  rules_disabled: number;
  outcome_action: OutcomeAction;
}

/** Elimina una etapa migrando oportunidades, tipificaciones y reglas. */
export function useDeleteStageSafely() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      stageId: string;
      targetStageId: string | null;
      outcomeAction: OutcomeAction;
      pipelineId: string;
    }): Promise<DeleteStageResult> => {
      const { data, error } = await (supabase as any).rpc("delete_pipeline_stage", {
        _stage_id: input.stageId,
        _target_stage_id: input.targetStageId,
        _outcome_action: input.outcomeAction,
      });
      if (error) throw error;
      return data as DeleteStageResult;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["settings-stages", v.pipelineId] });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      qc.invalidateQueries({ queryKey: ["pipeline-stage-rules", v.pipelineId] });
      qc.invalidateQueries({ queryKey: ["activity-outcomes"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["stage-impact"] });
    },
  });
}

/** Copia las tipificaciones de una etapa a otra. */
export function useCopyStageOutcomes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromStageId, toStageId }: { fromStageId: string; toStageId: string }) => {
      const { data, error } = await (supabase as any)
        .from("activity_outcomes")
        .select("*")
        .eq("stage_id", fromStageId);
      if (error) throw error;
      const rows = (data ?? []).map((o: any) => ({
        tenant_id: o.tenant_id,
        pipeline_id: o.pipeline_id,
        stage_id: toStageId,
        activity_kind: o.activity_kind,
        label: o.label,
        moves_to_stage_id: o.moves_to_stage_id === fromStageId ? toStageId : o.moves_to_stage_id,
        requires_next_action: o.requires_next_action,
        position: o.position,
        is_active: o.is_active,
      }));
      if (!rows.length) return 0;
      const { error: insErr } = await (supabase as any).from("activity_outcomes").insert(rows);
      if (insErr) throw insErr;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-outcomes"] }),
  });
}
