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

// ────────────────────────────────────────────────────────────────────────
// Local fallbacks (used only if the edge function is unreachable).
// These are deterministic helpers, NOT mock data — they produce a stable
// answer so the UI stays usable while the AI service recovers.
// ────────────────────────────────────────────────────────────────────────

function fallbackAiResponse(prompt: string): string {
  return `No pude conectar con el servicio de IA en este momento.\n\nIntenta de nuevo en unos segundos. Tu pregunta:\n\n> ${prompt}`;
}

function fallbackDealScore(input: {
  daysInStage: number;
  daysSinceLastActivity: number;
  openedProposalCount?: number;
  responseTimeHours?: number;
}): { score: number; reason: string } {
  let score = 60;
  if (input.responseTimeHours !== undefined && input.responseTimeHours < 2) score += 15;
  if ((input.openedProposalCount ?? 0) >= 3) score += 12;
  if (input.daysInStage <= 2) score += 8;
  else if (input.daysInStage > 10) score -= 20;
  if (input.daysSinceLastActivity <= 1) score += 5;
  else if (input.daysSinceLastActivity > 7) score -= 18;
  score = Math.max(5, Math.min(98, score));
  return { score, reason: `${score}% (cálculo local de respaldo)` };
}

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
  proposals: ProposedChange[];
  source: "live" | "error";
  errorMessage?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Proposed changes (Fase 1: Walix.ai como agente ejecutor)
// ────────────────────────────────────────────────────────────────────────

export type ProposalKind =
  | "update_deal_stage"
  | "update_deal_amount"
  | "mark_deal_won"
  | "mark_deal_lost"
  | "create_task"
  | "create_activity"
  | "update_contact"
  | "create_contact";

export interface ProposedChange {
  id: string;
  kind: ProposalKind;
  summary: string;
  payload: Record<string, unknown>;
  reasoning?: string;
  /** Filled client-side after calling previewProposal(). */
  before?: Record<string, unknown> | null;
  /** Filled client-side after calling previewProposal(). */
  after?: Record<string, unknown> | null;
}

export interface ExecuteResult {
  ok: boolean;
  target_type?: string;
  target_id?: string | null;
  error?: string;
}

export interface PreviewResult {
  ok: boolean;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  error?: string;
}

export async function previewProposal(p: ProposedChange): Promise<PreviewResult> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-execute", {
      body: { mode: "preview", proposal_id: p.id, kind: p.kind, payload: p.payload },
    });
    if (error) throw error;
    if (!data?.ok) return { ok: false, error: data?.error ?? "Error" };
    return { ok: true, before: data.before ?? null, after: data.after ?? null };
  } catch (err) {
    console.warn("[ai.previewProposal] error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function executeProposal(
  p: ProposedChange,
  ctx: { prompt?: string } = {},
): Promise<ExecuteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-execute", {
      body: {
        mode: "execute",
        proposal_id: p.id,
        kind: p.kind,
        payload: p.payload,
        summary: p.summary,
        prompt: ctx.prompt,
      },
    });
    if (error) throw error;
    if (!data?.ok) return { ok: false, error: data?.error ?? "Error" };
    return { ok: true, target_type: data.target_type, target_id: data.target_id };
  } catch (err) {
    console.warn("[ai.executeProposal] error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ────────────────────────────────────────────────────────────────────────
// Feedback (👍/👎) on AI responses
// ────────────────────────────────────────────────────────────────────────

export type AiRating = 1 | -1;

export async function submitAiFeedback(opts: {
  prompt: string;
  answer: string;
  rating: AiRating;
  comment?: string;
  surface?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("ai_feedback").insert({
      user_id: user.id,
      prompt: opts.prompt,
      answer: opts.answer,
      rating: opts.rating,
      comment: opts.comment ?? null,
      surface: opts.surface ?? "ai_drawer",
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.warn("[ai.submitAiFeedback] error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface AskAiContext {
  route?: string;
  entityType?: "deal" | "contact" | "convo";
  entityId?: string;
  entityLabel?: string;
}

/**
 * Free-form question for the global AiDrawer.
 * Sends conversation messages so the model can carry context.
 */
export async function askAi(opts: {
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  context?: AskAiContext;
}): Promise<AskAiResult> {
  const attempt = async () => {
    const { data, error } = await supabase.functions.invoke("global-ai", {
      body: {
        mode: "ask",
        prompt: opts.prompt,
        history: opts.history ?? [],
        context: opts.context ?? null,
      },
    });
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new Error(String(data.error));
    }
    const actions = Array.isArray(data?.actions) ? data.actions : [];
    const proposals = Array.isArray(data?.proposals) ? data.proposals : [];
    if (data?.text || actions.length || proposals.length) {
      return { text: data?.text ?? "", actions, proposals, source: "live" as const };
    }
    throw new Error("Respuesta vacía");
  };
  try {
    return await attempt();
  } catch (err1) {
    const msg1 = err1 instanceof Error ? err1.message : String(err1);
    const isRate = /429|rate|demasiad/i.test(msg1);
    const delays = isRate ? [1500, 3000] : [800];
    console.warn(`[ai.askAi] retry (${isRate ? "rate-limit" : "generic"}) after:`, msg1);
    let lastErr: unknown = err1;
    for (const d of delays) {
      await new Promise((r) => setTimeout(r, d));
      try {
        return await attempt();
      } catch (e) {
        lastErr = e;
        console.warn(`[ai.askAi] retry failed (waited ${d}ms):`, e);
      }
    }
    const msg = lastErr instanceof Error ? lastErr.message : "Error desconocido";
    return {
      text: fallbackAiResponse(opts.prompt),
      actions: [],
      proposals: [],
      source: "error",
      errorMessage: msg,
    };
  }
}

/**
 * Compute a closing-probability score for a deal.
 * Currently deterministic — kept here so the entire app reads from one place.
 */
export function scoreDeal(input: Parameters<typeof fallbackDealScore>[0]) {
  return fallbackDealScore(input);
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

// ────────────────────────────────────────────────────────────────────────
// Dashboard AI widgets + weekly report
// ────────────────────────────────────────────────────────────────────────

export interface PipelineHealthWidget {
  score: number;
  status: "excellent" | "good" | "warning" | "critical";
  summary: string;
  signals: { label: string; value: string; tone: "positive" | "neutral" | "negative" }[];
}

export interface OpportunityWidget {
  dealId: string;
  name: string;
  amount: number;
  reason: string;
  nextAction: string;
}

export interface RiskWidget {
  title: string;
  severity: "low" | "medium" | "high";
  detail: string;
  entityType: "deal" | "conversation" | "contact" | "pipeline";
  entityId?: string;
}

export interface WeeklyReportWidget {
  headline: string;
  highlights: string[];
  concerns: string[];
  nextWeekFocus: string[];
}

export interface DashboardAiResponse {
  pipelineHealth: PipelineHealthWidget;
  opportunities: OpportunityWidget[];
  risks: RiskWidget[];
  executiveSummary: string;
  weeklyReport?: WeeklyReportWidget;
  generatedAt: string;
  week: string;
  source: "live" | "fallback";
}

const FALLBACK_DASHBOARD: Omit<DashboardAiResponse, "generatedAt" | "week" | "source"> = {
  pipelineHealth: {
    score: 72,
    status: "good",
    summary: "Pipeline saludable con algunos deals que requieren seguimiento.",
    signals: [
      { label: "Deals activos", value: "—", tone: "neutral" },
      { label: "Forecast ponderado", value: "—", tone: "positive" },
      { label: "Estancados", value: "—", tone: "negative" },
    ],
  },
  opportunities: [],
  risks: [],
  executiveSummary: "Sin datos suficientes para generar el resumen IA. Conecta tu pipeline para ver insights en tiempo real.",
  weeklyReport: {
    headline: "Semana en marcha",
    highlights: ["Conecta tus datos para ver el resumen semanal."],
    concerns: [],
    nextWeekFocus: [],
  },
};

export async function fetchDashboardAiWidgets(includeReport = true): Promise<DashboardAiResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("dashboard-ai-widgets", {
      body: { includeReport },
    });
    if (error) throw error;
    if (!data?.pipelineHealth) throw new Error("Respuesta vacía");
    return { ...data, source: "live" };
  } catch (err) {
    console.warn("[ai.fetchDashboardAiWidgets] fallback:", err);
    return {
      ...FALLBACK_DASHBOARD,
      generatedAt: new Date().toISOString(),
      week: new Date().toISOString().slice(0, 10),
      source: "fallback",
    };
  }
}