import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineDeal } from "@/lib/queries/pipeline";
import { computeDealHealth } from "@/lib/dealHealth";

export interface PipelineAnalysis {
  health_score: number;
  summary: string;
  risks: { title: string; severity: "low" | "medium" | "high"; detail: string }[];
  recommendations: { title: string; action: string; impact: "low" | "medium" | "high" }[];
}

export interface NextStepSuggestion {
  next_step: string;
  reasoning: string;
  cta_label: string;
  urgency: "low" | "medium" | "high";
}

export interface ProbabilityScore {
  probability: number;
  reasoning: string;
  signals: string[];
}

function dealLite(d: PipelineDeal, lastActivityAt?: string | null) {
  const h = computeDealHealth(d, lastActivityAt ?? null);
  return {
    id: d.id,
    name: d.name,
    amount: d.amount,
    probability: d.probability,
    stageName: d.stageName,
    isWon: d.isWon,
    isLost: d.isLost,
    daysInStage: h.daysInStage,
    daysSinceContact: h.daysSinceContactActivity,
    expectedCloseDate: d.expectedCloseDate,
    notes: d.notes,
    source: d.source,
  };
}

async function invoke<T>(body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pipeline-ai", { body });
  if (error) throw new Error(error.message ?? "Error en IA");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function useAnalyzePipeline() {
  return useMutation({
    mutationFn: async (args: { deals: PipelineDeal[]; contactLastActivityById: Map<string, string | null> }) => {
      const lite = args.deals
        .filter(d => !d.isWon && !d.isLost)
        .map(d => dealLite(d, d.contactId ? args.contactLastActivityById.get(d.contactId) : null));
      return invoke<PipelineAnalysis>({ mode: "analyze_pipeline", deals: lite });
    },
  });
}

export function useSuggestNextStep() {
  return useMutation({
    mutationFn: async (args: { deal: PipelineDeal; lastActivityAt?: string | null }) => {
      return invoke<NextStepSuggestion>({
        mode: "suggest_next_step",
        deal: dealLite(args.deal, args.lastActivityAt),
      });
    },
  });
}

export function useScoreProbability() {
  return useMutation({
    mutationFn: async (args: { deal: PipelineDeal; lastActivityAt?: string | null }) => {
      return invoke<ProbabilityScore>({
        mode: "score_probability",
        deal: dealLite(args.deal, args.lastActivityAt),
      });
    },
  });
}