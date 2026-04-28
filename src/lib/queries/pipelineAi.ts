import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface DealAiSuggestion {
  id: string;
  dealId: string;
  text: string;
  cta: string | null;
  urgency: "low" | "medium" | "high";
}

function urgencyFromKind(kind: string | null): "low" | "medium" | "high" {
  if (kind?.endsWith("_high")) return "high";
  if (kind?.endsWith("_medium")) return "medium";
  return "low";
}

export function useAiSuggestionsByDeal() {
  return useQuery({
    queryKey: ["pipeline-ai-suggestions-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("id, deal_id, text, cta, kind, dismissed")
        .like("kind", "ai_next_step_%")
        .eq("dismissed", false)
        .not("deal_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, DealAiSuggestion>();
      for (const r of data ?? []) {
        if (!r.deal_id || map.has(r.deal_id)) continue;
        map.set(r.deal_id, {
          id: r.id, dealId: r.deal_id, text: r.text, cta: r.cta,
          urgency: urgencyFromKind(r.kind),
        });
      }
      return map;
    },
  });
}

export function useBulkSuggest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { deals: PipelineDeal[]; contactLastActivityById: Map<string, string | null> }) => {
      const lite = args.deals
        .filter(d => !d.isWon && !d.isLost)
        .map(d => dealLite(d, d.contactId ? args.contactLastActivityById.get(d.contactId) : null));
      return invoke<{ count: number }>({ mode: "bulk_suggest", deals: lite });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-ai-suggestions-map"] }),
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_suggestions").update({ dismissed: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-ai-suggestions-map"] }),
  });
}