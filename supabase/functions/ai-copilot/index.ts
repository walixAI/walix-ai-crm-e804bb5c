// Edge Function: ai-copilot
// Walix.ai Copiloto IA — Gemini 2.5 Pro vía Lovable AI Gateway con tool use.
// El usuario chatea, el modelo decide qué herramientas del CRM ejecutar (con
// JWT del usuario para respetar RLS) y devuelve una respuesta. WhatsApp NUNCA
// se envía sin confirmación humana — solo se prepara como `pendingWhatsapp`.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { getTenantPatterns, appendLearnedPatterns, getUserAIProfile, appendUserProfile } from "../_shared/ai-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-pro";
const MAX_ITERATIONS = 5;

// ────────────────────────────────────────────────────────────────────────
// Tools definition (OpenAI function-calling format, compatible with Gateway)
// ────────────────────────────────────────────────────────────────────────

const CRM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_pipeline_status",
      description: "Devuelve KPIs del pipeline activo del usuario: deals abiertos, ganados, perdidos y monto en curso.",
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
          query: { type: "string", description: "Texto a buscar" },
          limit: { type: "number", description: "Máx 10", default: 5 },
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
      description: "Lee el contexto de memoria IA de un contacto (resumen, hechos clave, urgencia, sentimiento) y sus últimos 10 eventos.",
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
      description: "Crea una oportunidad (deal) ligada a un contacto.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          title: { type: "string" },
          amount: { type: "number" },
          stage_id: { type: "string", description: "Opcional; si se omite usa la primera etapa del pipeline activo." },
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
      description: "Crea una tarea ligada a un contacto o deal, con fecha opcional.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["contact", "deal"] },
          entity_id: { type: "string" },
          title: { type: "string" },
          due_at: { type: "string", description: "ISO 8601 (opcional)" },
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
      description: "REGLA DE ORO: prepara un borrador de mensaje de WhatsApp para que el humano lo revise y envíe. NUNCA envía nada por sí sola.",
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
      name: "get_my_tasks",
      description: "Devuelve tareas del usuario actual (pendientes por defecto). Úsala cuando el usuario pregunte por 'mis pendientes', 'mis tareas', 'qué tengo hoy', etc.",
      parameters: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["today", "overdue", "upcoming", "all_open"], description: "today = vencen hoy; overdue = vencidas; upcoming = próximas 7 días; all_open = todas sin completar. Default: today+overdue combinado." },
          limit: { type: "number", description: "Máx 50", default: 20 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_suggestions",
      description: "Devuelve las sugerencias proactivas activas para el usuario actual (no descartadas).",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", default: 10 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_deals",
      description: "Devuelve los deals abiertos asignados al usuario actual, ordenados por monto.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", default: 10 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profitability",
      description: "Rentabilidad del tenant en un mes: ventas ganadas, gastos confirmados (fijos + variables), utilidad y margen %. Úsala para 'rentabilidad', 'margen', 'utilidad', 'cuánto gané', 'cuánto gasté vs vendí'.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Año (default: mes actual)" },
          month: { type: "number", description: "Mes 1-12 (default: mes actual)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_run_rate",
      description: "Run Rate del mes en curso: ventas ganadas MTD, ritmo diario, proyección fin de mes y % vs meta. Úsala para 'run rate', 'voy bien', 'llego a la meta', 'pronóstico del mes'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expenses_summary",
      description: "Resumen de gastos del tenant en un mes agrupados por categoría y por tipo (fijo/variable). Úsala para 'mis gastos', 'en qué gasto', 'cuánto llevo de gastos'.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          month: { type: "number" },
          status: { type: "string", enum: ["confirmed", "draft", "all"], default: "confirmed" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_goal",
      description: "Devuelve la meta mensual del tenant (total y por tipo de deal) para el mes indicado o el mes actual.",
      parameters: {
        type: "object",
        properties: { year: { type: "number" }, month: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_performance",
      description: "Rendimiento del equipo del tenant en el mes: deals ganados y monto por vendedor (owner).",
      parameters: {
        type: "object",
        properties: { year: { type: "number" }, month: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
];

// ────────────────────────────────────────────────────────────────────────
// Tool executor (uses user's Supabase client → respeta RLS)
// ────────────────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, any>,
  sb: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<any> {
  try {
    switch (name) {
      case "get_pipeline_status": {
        const { data: p } = await sb
          .from("pipelines")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .order("is_default", { ascending: false })
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        const pipelineId = p?.id;
        if (!pipelineId) return { ok: false, error: "Sin pipeline configurado" };

        const { data: stages } = await sb.from("pipeline_stages")
          .select("id").eq("pipeline_id", pipelineId);
        const stageIds = (stages ?? []).map((s: any) => s.id);
        if (!stageIds.length) return { ok: true, pipeline_id: pipelineId, open: 0, won: 0, lost: 0, open_amount: 0 };

        const { data: deals } = await sb
          .from("deals")
          .select("id, amount, is_won, is_lost")
          .eq("tenant_id", tenantId)
          .in("stage_id", stageIds);

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
        const { data, error } = await sb
          .from("contacts")
          .select("id, name, last_name, phone, email, status, source")
          .eq("tenant_id", tenantId)
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(limit);
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
          tenant_id: tenantId,
          name: args.name,
          phone: args.phone ?? null,
          email: args.email ?? null,
          source: args.source ?? "Manual",
          owner_id: userId,
        }).select("id, name, phone, email").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, contact: data };
      }

      case "create_deal": {
        let stageId = args.stage_id as string | undefined;
        let stageName: string | undefined;
        if (!stageId) {
          const { data: p } = await sb.from("pipelines")
            .select("id").eq("tenant_id", tenantId)
            .order("is_default", { ascending: false })
            .order("position", { ascending: true }).limit(1).maybeSingle();
          if (p?.id) {
            const { data: s } = await sb.from("pipeline_stages")
              .select("id, name").eq("pipeline_id", p.id)
              .order("position", { ascending: true }).limit(1).maybeSingle();
            stageId = s?.id;
            stageName = s?.name;
          }
        } else {
          const { data: s } = await sb.from("pipeline_stages")
            .select("name").eq("id", stageId).maybeSingle();
          stageName = s?.name;
        }
        if (!stageId) return { ok: false, error: "No se encontró etapa para el deal" };
        const { data, error } = await sb.from("deals").insert({
          tenant_id: tenantId,
          contact_id: args.contact_id,
          name: args.title,
          amount: args.amount ?? 0,
          stage_id: stageId,
          stage_name: stageName ?? null,
          owner_id: userId,
        }).select("id, name, amount, stage_id, stage_name").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, deal: data };
      }

      case "move_deal_stage": {
        const { data: stage } = await sb.from("pipeline_stages")
          .select("name").eq("id", args.stage_id).maybeSingle();
        const patch: Record<string, any> = { stage_id: args.stage_id };
        if (stage?.name) patch.stage_name = stage.name;
        const { data, error } = await sb.from("deals")
          .update(patch).eq("id", args.deal_id).select("id, stage_id, stage_name").single();
        if (error) return { ok: false, error: error.message };
        if (args.reason) {
          await sb.from("ai_memory_events").insert({
            tenant_id: tenantId, entity_type: "deal", entity_id: args.deal_id,
            event_type: "deal_stage_changed", event_data: { reason: args.reason, by: "copilot" },
            actor_id: userId,
          });
        }
        return { ok: true, deal: data };
      }

      case "add_note": {
        const { error } = await sb.from("activities").insert({
          tenant_id: tenantId,
          contact_id: args.entity_type === "contact" ? args.entity_id : null,
          deal_id: args.entity_type === "deal" ? args.entity_id : null,
          type: "note",
          description: args.text,
          agent_id: userId,
          occurred_at: new Date().toISOString(),
        });
        if (error) return { ok: false, error: error.message };
        await sb.from("ai_memory_events").insert({
          tenant_id: tenantId,
          entity_type: args.entity_type,
          entity_id: args.entity_id,
          event_type: "note_added",
          event_data: { length: String(args.text).length, by: "copilot" },
          actor_id: userId,
        });
        return { ok: true };
      }

      case "create_task": {
        const { data, error } = await sb.from("tasks").insert({
          tenant_id: tenantId,
          title: args.title,
          due_at: args.due_at ?? null,
          contact_id: args.entity_type === "contact" ? args.entity_id : null,
          deal_id: args.entity_type === "deal" ? args.entity_id : null,
          assignee_id: userId,
          completed: false,
        }).select("id, title, due_at").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, task: data };
      }

      case "prepare_whatsapp_message": {
        // NUNCA envía. Solo regresa el draft para que la UI lo muestre.
        return {
          ok: true,
          pending_whatsapp: { contact_id: args.contact_id, draft: args.draft },
          note: "Borrador preparado. El usuario debe confirmar antes de enviar.",
        };
      }

      case "get_my_tasks": {
        const view = String(args.view ?? "today_overdue");
        const limit = Math.min(50, Number(args.limit ?? 20));
        const nowIso = new Date().toISOString();
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const in7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

        let q = sb.from("tasks")
          .select("id, title, due_at, task_kind, completed, contact_id, deal_id")
          .eq("tenant_id", tenantId)
          .eq("assignee_id", userId)
          .eq("completed", false);

        if (view === "today") {
          q = q.gte("due_at", startOfDay.toISOString()).lte("due_at", endOfDay.toISOString());
        } else if (view === "overdue") {
          q = q.lt("due_at", nowIso);
        } else if (view === "upcoming") {
          q = q.gte("due_at", nowIso).lte("due_at", in7);
        } else if (view === "all_open") {
          // no extra filter
        } else {
          // default: today + overdue (todo lo que vence hoy o antes)
          q = q.lte("due_at", endOfDay.toISOString());
        }

        const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false }).limit(limit);
        if (error) return { ok: false, error: error.message };
        const tasks = data ?? [];

        // enriquecer con nombre de contacto/deal
        const contactIds = [...new Set(tasks.map((t: any) => t.contact_id).filter(Boolean))];
        const dealIds = [...new Set(tasks.map((t: any) => t.deal_id).filter(Boolean))];
        const [contactsRes, dealsRes] = await Promise.all([
          contactIds.length
            ? sb.from("contacts").select("id, name").in("id", contactIds)
            : Promise.resolve({ data: [] as any[] }),
          dealIds.length
            ? sb.from("deals").select("id, name").in("id", dealIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const contactMap = new Map((contactsRes.data ?? []).map((c: any) => [c.id, c.name]));
        const dealMap = new Map((dealsRes.data ?? []).map((d: any) => [d.id, d.name]));
        const enriched = tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          due_at: t.due_at,
          task_kind: t.task_kind,
          contact_name: t.contact_id ? contactMap.get(t.contact_id) ?? null : null,
          deal_name: t.deal_id ? dealMap.get(t.deal_id) ?? null : null,
          is_overdue: t.due_at ? new Date(t.due_at) < new Date() : false,
        }));
        return { ok: true, view, count: enriched.length, tasks: enriched };
      }

      case "get_my_suggestions": {
        const limit = Math.min(20, Number(args.limit ?? 10));
        const { data, error } = await sb.from("ai_proactive_suggestions")
          .select("id, suggestion_text, priority, entity_type, entity_id, action_type, created_at")
          .eq("tenant_id", tenantId)
          .eq("dismissed", false)
          .or(`target_user_id.eq.${userId},target_user_id.is.null`)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, count: (data ?? []).length, suggestions: data ?? [] };
      }

      case "get_my_deals": {
        const limit = Math.min(50, Number(args.limit ?? 10));
        const { data, error } = await sb.from("deals")
          .select("id, name, amount, stage_name, contact_id, updated_at")
          .eq("tenant_id", tenantId)
          .eq("owner_id", userId)
          .eq("is_won", false)
          .eq("is_lost", false)
          .order("amount", { ascending: false })
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, count: (data ?? []).length, deals: data ?? [] };
      }

      default:
        return { ok: false, error: `Tool desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error ejecutando tool" };
  }
}

// ────────────────────────────────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────────────────────────────────

async function buildSystemPrompt(
  sb: SupabaseClient,
  tenantId: string,
  userId: string,
  entityType: string | null,
  entityId: string | null,
): Promise<string> {
  const nowMx = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  const [{ data: tenant }, { data: profile }, { data: roles }, { data: pipeline }, { data: suggestions }] = await Promise.all([
    sb.from("tenants")
      .select("name, brand_name, industry, team_size, sales_channel, plan, currency, timezone, locale, monthly_goal_total, monthly_goal_by_type, whatsapp_phone")
      .eq("id", tenantId).maybeSingle(),
    sb.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("pipelines").select("id, name").eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("position", { ascending: true }).limit(1).maybeSingle(),
    sb.from("ai_proactive_suggestions")
      .select("suggestion_text, priority, entity_type, entity_id")
      .eq("dismissed", false).order("priority", { ascending: false }).limit(3),
  ]);

  let stages: any[] = [];
  if (pipeline?.id) {
    const { data } = await sb.from("pipeline_stages")
      .select("id, name, position").eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true });
    stages = data ?? [];
  }

  let entityCtx: any = null;
  if (entityType && entityId) {
    const { data } = await sb.from("ai_entity_context")
      .select("context_summary, key_facts, sentiment, urgency_score")
      .eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle();
    entityCtx = data;
  }

  const base = [
    "Eres Walix.ai, copiloto IA del CRM para PyMEs mexicanas.",
    "Hablas español, eres directo, conciso y orientado a acción.",
    "",
    `Hora local (CDMX): ${nowMx}`,
    tenant ? [
      `Empresa (tenant): "${tenant.brand_name ?? tenant.name}"`,
      tenant.industry ? `  Industria: ${tenant.industry}` : "",
      tenant.sales_channel ? `  Canal de ventas: ${tenant.sales_channel}` : "",
      tenant.team_size ? `  Tamaño de equipo: ${tenant.team_size}` : "",
      `  Plan: ${tenant.plan} | Moneda: ${tenant.currency} | Zona: ${tenant.timezone} | Locale: ${tenant.locale}`,
      tenant.whatsapp_phone ? `  WhatsApp Business: ${tenant.whatsapp_phone}` : "",
      Number(tenant.monthly_goal_total) > 0
        ? `  Meta mensual: ${tenant.currency} ${Number(tenant.monthly_goal_total).toLocaleString("es-MX")} (desglose: ${JSON.stringify(tenant.monthly_goal_by_type)})`
        : "",
    ].filter(Boolean).join("\n") : "Empresa (tenant): sin datos",
    "",
    `Usuario: ${profile?.full_name ?? profile?.email ?? "Operador"} | Roles: ${(roles ?? []).map((r: any) => r.role).join(", ") || "ninguno"}`,
    pipeline ? `Pipeline activo: "${pipeline.name}" — etapas: ${stages.map(s => s.name).join(" → ")}` : "Pipeline: sin configurar",
    "",
    entityCtx ? `Contexto de la entidad activa (${entityType}):
  Resumen: ${entityCtx.context_summary ?? "—"}
  Hechos: ${JSON.stringify(entityCtx.key_facts ?? [])}
  Sentimiento: ${entityCtx.sentiment} | Urgencia: ${entityCtx.urgency_score}/100` : "",
    "",
    suggestions?.length ? `Top sugerencias proactivas pendientes:
${suggestions.map((s: any) => `  • [p${s.priority}] ${s.suggestion_text}`).join("\n")}` : "",
    "",
    "Usa siempre el nombre y contexto de la empresa cuando respondas o redactes mensajes. No hables como asistente genérico.",
    "",
    "IMPORTANTE: NO digas 'no tengo forma de saber' cuando el usuario pregunte por sus datos.",
    "Tienes acceso completo a las tools del CRM. Ejemplos obligatorios:",
    "  • 'mis pendientes', 'qué tengo hoy', 'mis tareas', 'tengo algo vencido' → llama `get_my_tasks`.",
    "  • 'qué me sugieres', 'sugerencias', 'qué debería hacer' → llama `get_my_suggestions`.",
    "  • 'mis deals', 'mis oportunidades' → llama `get_my_deals`.",
    "  • 'cómo va mi pipeline', 'cuánto tengo en curso' → llama `get_pipeline_status`.",
    "Siempre intenta con las tools ANTES de responder que no puedes. Solo di que no hay información si la tool devolvió 0 resultados.",
    "",
    "REGLA DE ORO INVIOLABLE:",
    "Cuando el usuario pida enviar un WhatsApp, NUNCA llames otra cosa que no sea `prepare_whatsapp_message`.",
    "El humano siempre confirma y envía. Tú solo redactas el borrador.",
    "",
    "Cuando uses tools, encadénalas si hace falta (ej: search_contacts → get_contact_context → create_deal → prepare_whatsapp_message).",
    "Al terminar, responde en lenguaje natural confirmando lo que hiciste o preparaste.",
  ].filter(Boolean).join("\n");
  const [patterns, userProfile] = await Promise.all([
    getTenantPatterns(sb, tenantId),
    getUserAIProfile(sb, userId),
  ]);
  let prompt = appendLearnedPatterns(base, patterns);
  prompt = appendUserProfile(prompt, userProfile);
  return prompt;
}

// ────────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "No autenticado" }, 401);
    }

    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await sb.from("profiles")
      .select("active_tenant_id, tenant_id").eq("id", userId).maybeSingle();
    const tenantId = profile?.active_tenant_id ?? profile?.tenant_id;
    if (!tenantId) return json({ error: "Sin tenant activo" }, 400);

    const body = await req.json() as {
      message: string;
      conversationKey?: string;
      entityType?: string | null;
      entityId?: string | null;
      historyLimit?: number;
    };
    if (!body.message?.trim()) return json({ error: "Mensaje vacío" }, 400);

    const sessionId = body.conversationKey ?? "global";
    const historyLimit = Math.min(40, body.historyLimit ?? 20);

    // 1. Cargar historial previo
    const { data: prevHistory } = await sb
      .from("ai_conversation_history")
      .select("role, content, tool_calls")
      .eq("user_id", userId).eq("session_id", sessionId)
      .order("created_at", { ascending: false }).limit(historyLimit);
    const history = (prevHistory ?? []).reverse();

    // 2. Construir mensajes (con saneo defensivo del historial)
    const systemPrompt = await buildSystemPrompt(sb, tenantId, userId, body.entityType ?? null, body.entityId ?? null);
    const rebuilt: any[] = [];
    for (const h of history) {
      if (h.role === "assistant") {
        const msg: any = { role: "assistant", content: h.content ?? "" };
        if (h.tool_calls && Array.isArray(h.tool_calls) && h.tool_calls.length > 0) {
          msg.tool_calls = h.tool_calls;
        }
        rebuilt.push(msg);
      } else if (h.role === "tool") {
        // tool_call_id se persistió dentro de tool_calls como { tool_call_id, name }
        const meta = h.tool_calls && !Array.isArray(h.tool_calls) ? h.tool_calls : null;
        const tcid = meta?.tool_call_id;
        if (!tcid) continue; // descartar tool messages huérfanos
        const msg: any = {
          role: "tool",
          content: h.content ?? "",
          tool_call_id: tcid,
        };
        if (meta?.name) msg.name = meta.name;
        rebuilt.push(msg);
      } else {
        rebuilt.push({ role: h.role, content: h.content ?? "" });
      }
    }
    // Eliminar pares huérfanos: assistant.tool_calls sin todas las respuestas tool correspondientes
    const sanitized: any[] = [];
    for (let i = 0; i < rebuilt.length; i++) {
      const m = rebuilt[i];
      if (m.role === "assistant" && m.tool_calls?.length) {
        const expectedIds: string[] = m.tool_calls.map((t: any) => t.id).filter(Boolean);
        const followingToolIds = new Set<string>();
        let j = i + 1;
        while (j < rebuilt.length && rebuilt[j].role === "tool") {
          if (rebuilt[j].tool_call_id) followingToolIds.add(rebuilt[j].tool_call_id);
          j++;
        }
        const allPresent = expectedIds.every((id) => followingToolIds.has(id));
        if (!allPresent) {
          // saltar este assistant y los tool siguientes
          i = j - 1;
          continue;
        }
      }
      if (m.role === "tool" && sanitized.length === 0) continue; // tool sin assistant previo
      sanitized.push(m);
    }
    const messages: any[] = [{ role: "system", content: systemPrompt }, ...sanitized];
    messages.push({ role: "user", content: body.message });

    // 3. Persistir mensaje del usuario
    await sb.from("ai_conversation_history").insert({
      tenant_id: tenantId, user_id: userId, session_id: sessionId,
      role: "user", content: body.message,
    });

    // 4. Loop agéntico
    const toolsUsed: { name: string; args: any; result: any }[] = [];
    let pendingWhatsapp: { contact_id: string; draft: string } | undefined;
    let finalText = "";
    let usageInput = 0, usageOutput = 0, usageTotal = 0, usageIters = 0;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: CRM_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (aiRes.status === 429) return json({ error: "Rate limit. Intenta en unos segundos." }, 429);
      if (aiRes.status === 402) return json({ error: "Sin créditos en Lovable AI. Agrega fondos en Workspace > Usage." }, 402);
      // Fallback: si el historial está corrupto, reintentar con system + último user
      if (aiRes.status === 400 && iter === 0) {
        const t = await aiRes.text();
        console.warn("[ai-copilot] gateway 400, retrying without history:", t.slice(0, 300));
        const minimal = [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.message },
        ];
        messages.length = 0;
        messages.push(...minimal);
        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: MODEL, messages, tools: CRM_TOOLS, tool_choice: "auto" }),
        });
      }
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("[ai-copilot] gateway error", aiRes.status, t);
        return json({ error: "Error del modelo IA" }, 500);
      }

      const data = await aiRes.json();
      const u = data?.usage;
      if (u) {
        usageInput += Number(u.prompt_tokens ?? u.input_tokens ?? 0);
        usageOutput += Number(u.completion_tokens ?? u.output_tokens ?? 0);
        usageTotal += Number(u.total_tokens ?? 0);
      }
      usageIters = iter + 1;
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) return json({ error: "Respuesta vacía del modelo" }, 500);

      // ¿Tool calls?
      if (msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        await sb.from("ai_conversation_history").insert({
          tenant_id: tenantId, user_id: userId, session_id: sessionId,
          role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls,
        });

        for (const tc of msg.tool_calls) {
          let parsedArgs: any = {};
          try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* noop */ }
          const result = await executeTool(tc.function.name, parsedArgs, sb, tenantId, userId);
          toolsUsed.push({ name: tc.function.name, args: parsedArgs, result });
          if (tc.function.name === "prepare_whatsapp_message" && result?.ok) {
            pendingWhatsapp = result.pending_whatsapp;
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
          await sb.from("ai_conversation_history").insert({
            tenant_id: tenantId, user_id: userId, session_id: sessionId,
            role: "tool", content: JSON.stringify(result),
            tool_calls: { tool_call_id: tc.id, name: tc.function.name },
          });
        }
        continue; // re-llamar al modelo
      }

      finalText = msg.content ?? "";
      await sb.from("ai_conversation_history").insert({
        tenant_id: tenantId, user_id: userId, session_id: sessionId,
        role: "assistant", content: finalText,
      });
      break;
    }

    // Registro de uso (best-effort)
    try {
      await sb.from("ai_usage_log").insert({
        tenant_id: tenantId,
        user_id: userId,
        surface: "copilot",
        model: MODEL,
        input_tokens: usageInput,
        output_tokens: usageOutput,
        total_tokens: usageTotal || (usageInput + usageOutput),
        iterations: usageIters,
      });
    } catch { /* noop */ }

    return json({
      text: finalText || "(sin respuesta)",
      toolsUsed,
      pendingWhatsapp: pendingWhatsapp ?? null,
    });
  } catch (e) {
    console.error("[ai-copilot] fatal", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}