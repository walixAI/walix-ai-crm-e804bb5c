/**
 * Walix.ai — generative AI service layer.
 *
 * Single entry point used by every AI-powered surface (drawer, suggestions,
 * scoring, summaries). In the prototype it routes to the Lovable AI Gateway
 * via the `global-ai` edge function, with a deterministic mock fallback.
 *
 * In production this implementation calls Anthropic Claude directly:
 *   POST https://api.anthropic.com/v1/messages
 *   Authorization: Bearer ${ANTHROPIC_API_KEY}
 *
 * The public surface (askAi, suggestForDeal, summarizeConversation,
 * scoreDeal) stays the same so swapping the provider is a one-line change.
 */

import { supabase } from "@/integrations/supabase/client";
import { mockAiResponse, mockDealScore } from "@/mock/ai";

export const AI_MODEL_LABEL = "Claude Sonnet";

export interface AskAiResult {
  text: string;
  source: "live" | "fallback";
}

/**
 * Free-form question for the global AiDrawer.
 * Sends conversation messages so the model can carry context.
 */
export async function askAi(opts: {
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<AskAiResult> {
  try {
    const { data, error } = await supabase.functions.invoke("global-ai", {
      body: { mode: "ask", prompt: opts.prompt, history: opts.history ?? [] },
    });
    if (error) throw error;
    if (data?.text) return { text: data.text, source: "live" };
    throw new Error("Respuesta vacía");
  } catch (err) {
    console.warn("[ai.askAi] fallback to mock:", err);
    return { text: mockAiResponse(opts.prompt), source: "fallback" };
  }
}

/**
 * Compute a closing-probability score for a deal.
 * Currently deterministic — kept here so the entire app reads from one place.
 */
export function scoreDeal(input: Parameters<typeof mockDealScore>[0]) {
  return mockDealScore(input);
}

/** Convenience helper: format a relative "hace X" timestamp in Spanish. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}