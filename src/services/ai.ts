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

export type AiActionType =
  | "open_deal"
  | "open_contact"
  | "open_conversation"
  | "open_pipeline"
  | "open_inbox";

export interface AiAction {
  label: string;
  type: AiActionType;
  id?: string;
}

export interface AskAiResult {
  text: string;
  actions: AiAction[];
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
    if (data?.text) return { text: data.text, actions: Array.isArray(data.actions) ? data.actions : [], source: "live" };
    throw new Error("Respuesta vacía");
  } catch (err) {
    console.warn("[ai.askAi] fallback to mock:", err);
    return { text: mockAiResponse(opts.prompt), actions: [], source: "fallback" };
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

// ────────────────────────────────────────────────────────────────────────
// Pipeline configuration suggestion (Onboarding)
// ────────────────────────────────────────────────────────────────────────

export interface SuggestedStage { name: string; probability: number }
export interface SuggestedField { label: string; type: "text" | "number" | "date" | "select"; reason: string }
export interface SuggestedAutomation { trigger: string; action: string }

export interface PipelineSuggestion {
  stages: SuggestedStage[];
  customFields: SuggestedField[];
  automations: SuggestedAutomation[];
  source: "live" | "fallback";
}

const FALLBACK_SUGGESTION: Omit<PipelineSuggestion, "source"> = {
  stages: [
    { name: "Nuevo lead", probability: 10 },
    { name: "Contactado", probability: 25 },
    { name: "Cotización enviada", probability: 50 },
    { name: "Negociación", probability: 70 },
    { name: "Cerrado ganado", probability: 100 },
    { name: "Cerrado perdido", probability: 0 },
  ],
  customFields: [
    { label: "Presupuesto estimado", type: "number", reason: "Calificar leads por capacidad de compra." },
    { label: "Fecha tentativa de cierre", type: "date", reason: "Pronosticar ingresos del mes." },
    { label: "Origen del lead", type: "select", reason: "Saber qué canales convierten mejor." },
  ],
  automations: [
    { trigger: "Lead nuevo sin atender >2h", action: "Notificar al vendedor y enviar mensaje de bienvenida." },
    { trigger: "Deal sin actividad >7 días", action: "Crear tarea de seguimiento para el dueño." },
    { trigger: "Cliente abre la cotización 3 veces", action: "Sugerir llamada inmediata al vendedor." },
  ],
};

export async function suggestPipeline(business: string): Promise<PipelineSuggestion> {
  try {
    const { data, error } = await supabase.functions.invoke("pipeline-suggest", {
      body: { business },
    });
    if (error) throw error;
    if (!data?.stages?.length) throw new Error("Respuesta vacía");
    return {
      stages: data.stages,
      customFields: data.customFields ?? [],
      automations: data.automations ?? [],
      source: "live",
    };
  } catch (err) {
    console.warn("[ai.suggestPipeline] fallback:", err);
    return { ...FALLBACK_SUGGESTION, source: "fallback" };
  }
}

// ────────────────────────────────────────────────────────────────────────
// AI Inbox — proactive suggestions
// ────────────────────────────────────────────────────────────────────────

export type AiInboxItemType =
  | "cold_deal" | "hot_deal" | "unread_message" | "missing_followup" | "stale_lead";
export type AiInboxCategory = "deals" | "messages" | "pipeline";
export type AiInboxSeverity = "low" | "medium" | "high";

export interface AiInboxItem {
  id: string;
  type: AiInboxItemType;
  category: AiInboxCategory;
  severity: AiInboxSeverity;
  title: string;
  description: string;
  amount?: number;
  daysSince?: number;
  action: { label: string; type: "open_deal" | "open_conversation" | "open_contact"; id: string };
  createdAt: string;
}

export interface AiInboxResponse {
  suggestions: AiInboxItem[];
  counts: { total: number; deals: number; messages: number; pipeline: number };
  source: "live" | "fallback";
}

export async function fetchAiInbox(): Promise<AiInboxResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-inbox", { body: {} });
    if (error) throw error;
    if (!data?.suggestions) throw new Error("Respuesta vacía");
    return { ...data, source: "live" };
  } catch (err) {
    console.warn("[ai.fetchAiInbox] fallback:", err);
    return { suggestions: [], counts: { total: 0, deals: 0, messages: 0, pipeline: 0 }, source: "fallback" };
  }
}