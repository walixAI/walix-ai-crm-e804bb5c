// Shared CRM tools, executor, and agentic loop used by ai-copilot and ai-agent-runner.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export interface LearnedPattern {
  pattern_type: string;
  pattern_data: any;
  confidence_score: number;
  sample_size: number;
}

export async function getTenantPatterns(sb: SupabaseClient, tenantId: string, limit = 6): Promise<LearnedPattern[]> {
  const { data } = await sb.from("ai_tenant_patterns")
    .select("pattern_type, pattern_data, confidence_score, sample_size")
    .eq("tenant_id", tenantId)
    .order("confidence_score", { ascending: false })
    .limit(limit);
  return (data ?? []) as LearnedPattern[];
}

export function formatPattern(p: LearnedPattern): string {
  const d = p.pattern_data ?? {};
  switch (p.pattern_type) {
    case "best_followup_day":
      return `Mejor día para seguimientos: ${d.day} (tasa de respuesta ${Math.round((d.response_rate ?? 0) * 100)}%).`;
    case "peak_response_hours":
      return `Horas pico de respuesta: ${(d.hours ?? []).join(", ")} (${d.timezone ?? "America/Mexico_City"}).`;
    case "avg_close_days":
      return `Tiempo promedio de cierre: ${d.days} días.`;
    case "top_objections":
      return `Objeciones más frecuentes: ${(d.objections ?? []).join(", ")}.`;
    case "best_message_style":
      return `Estilo de mensaje que mejor funciona: ${d.style}.`;
    case "winning_sequences":
      return `Secuencia ganadora: ${(d.steps ?? []).join(" → ")}.`;
    case "top_seller_by_stage":
      return `Vendedor estrella en ${d.stage}: ${d.seller} (${Math.round((d.rate ?? 0) * 100)}% de avance).`;
    default:
      return `${p.pattern_type}: ${JSON.stringify(d)}`;
  }
}

export function appendLearnedPatterns(systemPrompt: string, patterns: LearnedPattern[]): string {
  if (!patterns.length) return systemPrompt;
  const lines = patterns.map((p) => `  • ${formatPattern(p)} (confianza ${(p.confidence_score * 100).toFixed(0)}%, n=${p.sample_size})`);
  return `${systemPrompt}\n\nPATRONES APRENDIDOS DE ESTE NEGOCIO (úsalos para personalizar tus sugerencias):\n${lines.join("\n")}`;
}

export const CRM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_pipeline_status",
      description: "Devuelve KPIs del pipeline activo del tenant: deals abiertos, ganados, perdidos y monto en curso.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Busca contactos por nombre, teléfono o email. Devuelve hasta 10 coincidencias.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number", default: 5 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_context",
      description: "Lee el contexto IA de un contacto y sus últimos 10 eventos.",
      parameters: {
        type: "object",
        properties: { contact_id: { type: "string" } },
        required: ["contact_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Crea un nuevo contacto en el CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          source: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Crea una oportunidad ligada a un contacto.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          title: { type: "string" },
          amount: { type: "number" },
          stage_id: { type: "string" },
        },
        required: ["contact_id", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_deal_stage",
      description: "Mueve un deal a otra etapa del pipeline.",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          stage_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["deal_id", "stage_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Agrega una nota interna a un contacto o deal.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["contact", "deal"] },
          entity_id: { type: "string" },
          text: { type: "string" },
        },
        required: ["entity_type", "entity_id", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea una tarea ligada a un contacto o deal.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["contact", "deal"] },
          entity_id: { type: "string" },
          title: { type: "string" },
          due_at: { type: "string" },
        },
        required: ["entity_type", "entity_id", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_whatsapp_message",
      description: "REGLA DE ORO: prepara un borrador de WhatsApp para que el humano lo confirme. NUNCA envía.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          draft: { type: "string" },
        },
        required: ["contact_id", "draft"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_proactive_suggestion",
      description: "Crea una sugerencia proactiva visible en el dashboard / copiloto. Útil para agentes y briefings.",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string", description: "UUID del usuario destinatario; omite para visible a todo el tenant" },
          entity_type: { type: "string" },
          entity_id: { type: "string" },
          suggestion_text: { type: "string" },
          action_type: { type: "string" },
          action_payload: { type: "object" },
          priority: { type: "number", description: "1-10, mayor = más urgente" },
        },
        required: ["suggestion_text", "priority"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tenant_pattern",
      description: "Guarda o actualiza un patrón aprendido del negocio (usado por el agente Aprendiz).",
      parameters: {
        type: "object",
        properties: {
          pattern_type: { type: "string", description: "best_followup_day | avg_close_days | top_objections | best_message_style | peak_response_hours | winning_sequences | top_seller_by_stage" },
          pattern_data: { type: "object" },
          confidence_score: { type: "number", description: "0..1" },
          sample_size: { type: "number" },
        },
        required: ["pattern_type", "pattern_data", "confidence_score", "sample_size"],
        additionalProperties: false,
      },
    },
  },
] as const;

export async function executeTool(
  name: string,
  args: Record<string, any>,
  sb: SupabaseClient,
  tenantId: string,
  userId: string | null,
): Promise<any> {
  try {
    switch (name) {
      case "get_pipeline_status": {
        const { data: p } = await sb.from("pipelines").select("id, name")
          .eq("tenant_id", tenantId)
          .order("is_default", { ascending: false })
          .order("position", { ascending: true }).limit(1).maybeSingle();
        const pipelineId = p?.id;
        if (!pipelineId) return { ok: false, error: "Sin pipeline" };
        const { data: stages } = await sb.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId);
        const stageIds = (stages ?? []).map((s: any) => s.id);
        if (!stageIds.length) return { ok: true, pipeline_id: pipelineId, open: 0, won: 0, lost: 0, open_amount: 0 };
        const { data: deals } = await sb.from("deals")
          .select("id, amount, is_won, is_lost").eq("tenant_id", tenantId).in("stage_id", stageIds);
        const summary = { open: 0, won: 0, lost: 0, open_amount: 0 };
        for (const d of deals ?? []) {
          if (d.is_won) summary.won++;
          else if (d.is_lost) summary.lost++;
          else { summary.open++; summary.open_amount += Number(d.amount ?? 0); }
        }
        return { ok: true, pipeline_id: pipelineId, pipeline_name: p?.name, ...summary };
      }
      case "search_contacts": {
        const q = String(args.query ?? "").trim();
        const limit = Math.min(10, Number(args.limit ?? 5));
        if (!q) return { ok: false, error: "query vacío" };
        const { data, error } = await sb.from("contacts")
          .select("id, name, last_name, phone, email, status, source")
          .eq("tenant_id", tenantId)
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, contacts: data ?? [] };
      }
      case "get_contact_context": {
        const id = String(args.contact_id ?? "");
        const [{ data: ctx }, { data: events }, { data: contact }] = await Promise.all([
          sb.from("ai_entity_context")
            .select("context_summary, key_facts, sentiment, urgency_score, last_interaction")
            .eq("entity_type", "contact").eq("entity_id", id).maybeSingle(),
          sb.from("ai_memory_events")
            .select("event_type, event_data, created_at")
            .eq("entity_type", "contact").eq("entity_id", id)
            .order("created_at", { ascending: false }).limit(10),
          sb.from("contacts")
            .select("id, name, last_name, phone, email, status, source, owner_id")
            .eq("id", id).maybeSingle(),
        ]);
        return { ok: true, contact, context: ctx ?? null, recent_events: events ?? [] };
      }
      case "create_contact": {
        const { data, error } = await sb.from("contacts").insert({
          tenant_id: tenantId, name: args.name,
          phone: args.phone ?? null, email: args.email ?? null,
          source: args.source ?? "Manual", owner_id: userId,
        }).select("id, name, phone, email").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, contact: data };
      }
      case "create_deal": {
        let stageId = args.stage_id as string | undefined;
        let stageName: string | undefined;
        if (!stageId) {
          const { data: p } = await sb.from("pipelines").select("id").eq("tenant_id", tenantId)
            .order("is_default", { ascending: false }).order("position", { ascending: true }).limit(1).maybeSingle();
          if (p?.id) {
            const { data: s } = await sb.from("pipeline_stages").select("id, name")
              .eq("pipeline_id", p.id).order("position", { ascending: true }).limit(1).maybeSingle();
            stageId = s?.id; stageName = s?.name;
          }
        } else {
          const { data: s } = await sb.from("pipeline_stages").select("name").eq("id", stageId).maybeSingle();
          stageName = s?.name;
        }
        if (!stageId) return { ok: false, error: "Sin etapa" };
        const { data, error } = await sb.from("deals").insert({
          tenant_id: tenantId, contact_id: args.contact_id, name: args.title,
          amount: args.amount ?? 0, stage_id: stageId, stage_name: stageName ?? null, owner_id: userId,
        }).select("id, name, amount, stage_id, stage_name").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, deal: data };
      }
      case "move_deal_stage": {
        const { data: stage } = await sb.from("pipeline_stages").select("name").eq("id", args.stage_id).maybeSingle();
        const patch: Record<string, any> = { stage_id: args.stage_id };
        if (stage?.name) patch.stage_name = stage.name;
        const { data, error } = await sb.from("deals").update(patch)
          .eq("id", args.deal_id).select("id, stage_id, stage_name").single();
        if (error) return { ok: false, error: error.message };
        if (args.reason) {
          await sb.from("ai_memory_events").insert({
            tenant_id: tenantId, entity_type: "deal", entity_id: args.deal_id,
            event_type: "deal_stage_changed", event_data: { reason: args.reason, by: "ai" }, actor_id: userId,
          });
        }
        return { ok: true, deal: data };
      }
      case "add_note": {
        const { error } = await sb.from("activities").insert({
          tenant_id: tenantId,
          contact_id: args.entity_type === "contact" ? args.entity_id : null,
          deal_id: args.entity_type === "deal" ? args.entity_id : null,
          type: "note", description: args.text, agent_id: userId,
          occurred_at: new Date().toISOString(),
        });
        if (error) return { ok: false, error: error.message };
        await sb.from("ai_memory_events").insert({
          tenant_id: tenantId, entity_type: args.entity_type, entity_id: args.entity_id,
          event_type: "note_added", event_data: { length: String(args.text).length, by: "ai" }, actor_id: userId,
        });
        return { ok: true };
      }
      case "create_task": {
        const { data, error } = await sb.from("tasks").insert({
          tenant_id: tenantId, title: args.title, due_at: args.due_at ?? null,
          contact_id: args.entity_type === "contact" ? args.entity_id : null,
          deal_id: args.entity_type === "deal" ? args.entity_id : null,
          assignee_id: userId, completed: false,
        }).select("id, title, due_at").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, task: data };
      }
      case "prepare_whatsapp_message": {
        return {
          ok: true,
          pending_whatsapp: { contact_id: args.contact_id, draft: args.draft },
          note: "Borrador preparado. El humano debe confirmar antes de enviar.",
        };
      }
      case "create_proactive_suggestion": {
        const priority = Math.min(10, Math.max(1, Number(args.priority ?? 5)));
        const { data, error } = await sb.from("ai_proactive_suggestions").insert({
          tenant_id: tenantId,
          target_user_id: args.target_user_id ?? null,
          entity_type: args.entity_type ?? null,
          entity_id: args.entity_id ?? null,
          suggestion_text: args.suggestion_text,
          action_type: args.action_type ?? null,
          action_payload: args.action_payload ?? {},
          priority,
        }).select("id").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, suggestion_id: data.id };
      }
      case "update_tenant_pattern": {
        const conf = Math.max(0, Math.min(1, Number(args.confidence_score ?? 0)));
        const { error } = await sb.from("ai_tenant_patterns").upsert({
          tenant_id: tenantId,
          pattern_type: String(args.pattern_type),
          pattern_data: args.pattern_data ?? {},
          confidence_score: conf,
          sample_size: Number(args.sample_size ?? 0),
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,pattern_type" });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
      default:
        return { ok: false, error: `Tool desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export interface AgenticLoopOptions {
  sb: SupabaseClient;
  tenantId: string;
  userId: string | null;
  systemPrompt: string;
  userMessage: string;
  priorMessages?: any[];
  allowedTools?: string[]; // names; default = all
  model?: string;
  maxIterations?: number;
  onAssistant?: (msg: any) => Promise<void> | void;
  onTool?: (call: { name: string; args: any; result: any; tool_call_id: string }) => Promise<void> | void;
}

export interface AgenticLoopResult {
  finalText: string;
  toolsUsed: { name: string; args: any; result: any }[];
  pendingWhatsapp: { contact_id: string; draft: string } | null;
  iterations: number;
}

export async function runAgenticLoop(opts: AgenticLoopOptions): Promise<AgenticLoopResult> {
  const {
    sb, tenantId, userId, systemPrompt, userMessage,
    priorMessages = [], allowedTools, model = "google/gemini-2.5-flash",
    maxIterations = 5, onAssistant, onTool,
  } = opts;

  const tools = allowedTools
    ? CRM_TOOLS.filter((t) => allowedTools.includes(t.function.name))
    : CRM_TOOLS;

  const learned = await getTenantPatterns(sb, tenantId);
  const finalSystem = appendLearnedPatterns(systemPrompt, learned);

  const messages: any[] = [
    { role: "system", content: finalSystem },
    ...priorMessages,
    { role: "user", content: userMessage },
  ];

  const toolsUsed: { name: string; args: any; result: any }[] = [];
  let pendingWhatsapp: { contact_id: string; draft: string } | null = null;
  let finalText = "";
  let iter = 0;

  for (; iter < maxIterations; iter++) {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`gateway ${aiRes.status}: ${t.slice(0, 200)}`);
    }
    const data = await aiRes.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error("respuesta vacía del modelo");

    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      if (onAssistant) await onAssistant(msg);
      for (const tc of msg.tool_calls) {
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* noop */ }
        const result = await executeTool(tc.function.name, parsedArgs, sb, tenantId, userId);
        toolsUsed.push({ name: tc.function.name, args: parsedArgs, result });
        if (tc.function.name === "prepare_whatsapp_message" && result?.ok) {
          pendingWhatsapp = result.pending_whatsapp;
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        if (onTool) await onTool({ name: tc.function.name, args: parsedArgs, result, tool_call_id: tc.id });
      }
      continue;
    }

    finalText = msg.content ?? "";
    if (onAssistant) await onAssistant(msg);
    break;
  }

  return { finalText, toolsUsed, pendingWhatsapp, iterations: iter + 1 };
}