// Edge Function: ai-copilot
// Walix.ai Copiloto IA — Gemini 2.5 Pro vía Lovable AI Gateway con tool use.
// El usuario chatea, el modelo decide qué herramientas del CRM ejecutar (con
// JWT del usuario para respetar RLS) y devuelve una respuesta. WhatsApp NUNCA
// se envía sin confirmación humana — solo se prepara como `pendingWhatsapp`.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { getTenantPatterns, appendLearnedPatterns, getUserAIProfile, appendUserProfile } from "../_shared/ai-tools.ts";
import { resolveTenantModel, DEFAULT_MODEL } from "../_shared/tenant-model.ts";
import { recordAiUsage } from "../_shared/ai-usage.ts";
import { searchGuide, guideIndex } from "../_shared/walix-guide.ts";
import {
  bulkPreview, bulkConfirm, bulkApply, bulkUndo, bulkCancel, bulkList,
  type BulkEntity,
} from "../_shared/bulk-edit.ts";
import { getDisabledNativeTools, filterTools } from "../_shared/native-caps.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FALLBACK_MODEL = DEFAULT_MODEL;
const MAX_ITERATIONS = 5;

// ────────────────────────────────────────────────────────────────────────
// Tools definition (OpenAI function-calling format, compatible with Gateway)
// ────────────────────────────────────────────────────────────────────────

const CRM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_help_topic",
      description: "MODO TUTOR: devuelve la guía de uso de Walix (pasos, ruta y tips) para una duda del usuario sobre cómo funciona o cómo hacer algo en el CRM. Úsala siempre que pregunten 'cómo...', 'dónde...', 'para qué sirve...', 'no sé usar...'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Duda del usuario en sus palabras, ej. 'cómo importo mis clientes'" },
          list_all: { type: "boolean", description: "true para devolver el índice completo de secciones de Walix" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_scheduled_services",
      description: "Lista los servicios recurrentes programados (mantenimientos, cambios de filtro) de un mes.",
      parameters: {
        type: "object",
        properties: {
          month_offset: { type: "number", description: "0 = mes en curso, 1 = próximo mes, -1 = mes pasado" },
          type: { type: "string", description: "Filtro por nombre del servicio" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pipeline_status",
      description: "Devuelve KPIs del pipeline que el usuario tiene abierto en pantalla (mismo conteo que la vista Pipeline): deals abiertos, ganados, perdidos, monto en curso y desglose por etapa. Si no se indica pipeline_id se usa el pipeline activo del usuario.",
      parameters: {
        type: "object",
        properties: { pipeline_id: { type: "string", description: "UUID del pipeline. Opcional." } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_activities",
      description:
        "Lista actividades registradas (llamadas, visitas, reuniones, correos, WhatsApp, notas) en un rango de fechas. Úsalo para preguntas tipo 'visitas de esta semana', 'llamadas de ayer', 'seguimientos del mes'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "hoy | ayer | semana | semana_pasada | mes | mes_pasado. Default: semana" },
          date_from: { type: "string", description: "Fecha inicial YYYY-MM-DD (opcional, gana sobre period)" },
          date_to: { type: "string", description: "Fecha final YYYY-MM-DD (opcional)" },
          kind: { type: "string", description: "Texto del tipo de actividad, ej. 'visita', 'llamada', 'correo', 'whatsapp', 'reunión'" },
          scope: { type: "string", description: "mine = solo mías, tenant = de todo el equipo" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
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
      description: "Lee el contexto de un contacto (resumen, hechos clave, urgencia, sentimiento), sus últimos 10 eventos y TODAS sus oportunidades (abiertas, ganadas y perdidas) con etapa, monto y fecha de ganado.",
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
      name: "mark_deal_won",
      description: "Marca una oportunidad como GANADA o corrige la fecha real de cierre de una que YA está ganada (úsala siempre que el usuario pida cambiar/corregir la fecha de ganado o de cobro de UN deal; no uses bulk_preview para eso). Permite fijar la fecha real de cierre (won_date) para que la venta se contabilice en el mes correcto. La fecha puede ser de cualquier día pasado (incluso meses atrás); nunca futura. Si se omite se usa la fecha y hora actual. Si la fecha es anterior a la creación del deal, la fecha de creación se recorre a un día antes y debes avisarle al usuario.",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          won_date: { type: "string", description: "Fecha real de cierre YYYY-MM-DD (opcional, debe ser hoy o anterior)" },
        },
        required: ["deal_id"],
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
          scope: { type: "string", enum: ["mine", "tenant"], description: "'mine'=solo del usuario; 'tenant'=todo el equipo. Default: 'tenant' si es admin/owner, 'mine' en otro caso." },
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
      description: "Devuelve deals abiertos. scope='mine' solo los del usuario; scope='tenant' TODOS los del negocio (usar cuando el usuario sea admin/owner o pregunte por 'oportunidades del mes', 'del equipo', 'del negocio'). Default: 'tenant' si el usuario es admin/owner, 'mine' en otro caso.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 20 },
          scope: { type: "string", enum: ["mine", "tenant"] },
          closing_this_month: { type: "boolean", description: "Si true, filtra por expected_close_date dentro del mes actual." },
        },
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
      name: "set_widget_visibility",
      description:
        "Muestra u oculta una tarjeta (widget) del Dashboard o de Mi Día para TODO el equipo (layout por defecto del tenant). Solo tenant_owner/tenant_admin/org_owner. Si no sabes el nombre exacto, primero llama list_widgets.",
      parameters: {
        type: "object",
        properties: {
          surface: { type: "string", enum: ["dashboard", "mi_dia"], description: "Pantalla: dashboard o mi_dia" },
          widget: { type: "string", description: "Nombre o clave de la tarjeta, ej. 'Rentabilidad' o 'dash.profitability'" },
          visible: { type: "boolean", description: "true para mostrarla, false para ocultarla" },
        },
        required: ["surface", "widget", "visible"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_widgets",
      description: "Lista las tarjetas configurables de una pantalla (dashboard o mi_dia) y si están visibles u ocultas para el equipo.",
      parameters: {
        type: "object",
        properties: { surface: { type: "string", enum: ["dashboard", "mi_dia"] } },
        required: ["surface"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_monthly_goal",
      description:
        "Ajusta la meta mensual del tenant. Solo tenant_owner/tenant_admin/org_owner. No permite meses pasados. Antes de llamarla, SIEMPRE confirma con el usuario mes/año y monto total en pesos.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Año de la meta (default: año actual)" },
          month: { type: "number", description: "Mes 1-12 (default: mes actual)" },
          total: { type: "number", description: "Monto total de la meta en la moneda del tenant" },
          by_type: {
            type: "object",
            description: "Desglose opcional por tipo de deal",
            properties: {
              venta: { type: "number" },
              servicio: { type: "number" },
              refaccion: { type: "number" },
            },
            additionalProperties: false,
          },
          note: { type: "string", description: "Nota corta sobre por qué se ajusta" },
          confirmed: { type: "boolean", description: "Debe ser true — el usuario ya confirmó explícitamente el cambio." },
        },
        required: ["total", "confirmed"],
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
  // ── Cambios masivos (SOLO dueño del Tenant) ──────────────────────────
  {
    type: "function",
    function: {
      name: "list_team_members",
      description:
        "Lista los usuarios del tenant con su id, nombre y correo. Úsala SIEMPRE antes de un cambio masivo filtrado por persona (ej. 'la actividad de Norma') para resolver el owner_id correcto.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", description: "Texto por nombre o correo (opcional)" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_preview",
      description:
        "PASO 1 de una operación masiva sobre contactos, oportunidades, tareas o actividades. NO modifica nada: devuelve cuántos registros coinciden y una muestra. Úsala cuando el usuario pida cambiar o borrar varios registros a la vez (ej. 'a todas las oportunidades de Mantenimiento cámbiales el monto a 3400', 'borra toda la actividad que registró Norma en agosto'). Solo funciona para el dueño del Tenant.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["contacts", "deals", "tasks", "activities"] },
          mode: {
            type: "string",
            enum: ["update", "delete"],
            description: "update (por defecto) o delete. El borrado se permite en 'activities', 'tasks' y 'deals' (oportunidades), y guarda respaldo para revertir.",
          },
          filters: {
            type: "object",
            description:
              "Claves aceptadas: comunes: name_contains, ids, owner_id (en actividades = quien la registró, en tareas = responsable), contact_id, contact_name (se resuelve solo; si hay varias coincidencias te pedirá elegir). deals: stage_id, stage_name, deal_type, service_type, payment_status, only_open, is_won, is_lost, amount_equals, date_from, date_to. contacts: status, source. tasks: deal_id, completed, task_kind, date_from, date_to. activities: type, deal_id, date_from, date_to. Se aceptan sinónimos comunes (deal_ids, assignee_id, from_date, etc.) y se traducen automáticamente. IMPORTANTE: si el usuario pide 'todas las oportunidades de un contacto', NO uses only_open (dejaría fuera ganadas y perdidas); usa solo contact_id/contact_name. Si el usuario pega una URL tipo /contacts/<uuid>, ese uuid es el contact_id.",

            additionalProperties: true,
          },
          changes: {
            type: "object",
            description:
              "Campos a cambiar (no aplica si mode=delete). deals: amount, cost_amount, probability, stage_id, stage_name, owner_id, expected_close_date, deal_type, service_type, payment_status, is_won, is_lost, notes, won_at (fecha real de cierre/cobro, YYYY-MM-DD; nunca futura; al fijarla la oportunidad queda como ganada). contacts: status, owner_id, source, lifecycle, company. tasks: assignee_id, due_at, completed, task_kind, title.",
            additionalProperties: true,
          },
        },
        required: ["entity", "filters"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_confirm",
      description:
        "PASO 2: solo después de que el usuario dijo explícitamente que sí a la vista previa. Devuelve un código de seguridad de 6 dígitos que el usuario debe escribir.",
      parameters: {
        type: "object",
        properties: { operation_id: { type: "string" } },
        required: ["operation_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_apply",
      description:
        "PASO 3: ejecuta el cambio masivo. Solo se llama cuando el usuario ESCRIBIÓ el código de 6 dígitos. Nunca inventes el código.",
      parameters: {
        type: "object",
        properties: { operation_id: { type: "string" }, confirm_code: { type: "string" } },
        required: ["operation_id", "confirm_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_undo",
      description: "Revierte un cambio masivo ya aplicado, restaurando los valores anteriores.",
      parameters: {
        type: "object",
        properties: { operation_id: { type: "string" } },
        required: ["operation_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_cancel",
      description: "Cancela un cambio masivo que aún no se ha aplicado.",
      parameters: {
        type: "object",
        properties: { operation_id: { type: "string" } },
        required: ["operation_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_list",
      description: "Lista los últimos cambios masivos del tenant (para auditar o revertir).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
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
  uiPipelineId?: string | null,
): Promise<any> {
  try {
    switch (name) {
      case "get_help_topic": {
        if (args.list_all) return { ok: true, sections: guideIndex() };
        const topics = searchGuide(String(args.query ?? ""));
        return { ok: true, topics };
      }

      case "bulk_preview":
        return await bulkPreview(
          sb, tenantId, userId, args.entity as BulkEntity,
          args.filters ?? {}, args.changes ?? {},
          args.mode === "delete" ? "delete" : "update",
        );
      case "list_team_members": {
        let q = sb.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId).limit(50);
        if (args.search) q = q.or(`full_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, members: data ?? [] };
      }
      case "bulk_confirm":
        return await bulkConfirm(sb, tenantId, userId, String(args.operation_id));
      case "bulk_apply":
        return await bulkApply(sb, tenantId, userId, String(args.operation_id), String(args.confirm_code ?? ""));
      case "bulk_undo":
        return await bulkUndo(sb, tenantId, userId, String(args.operation_id));
      case "bulk_cancel":
        return await bulkCancel(sb, tenantId, String(args.operation_id));
      case "bulk_list":
        return await bulkList(sb, tenantId);

      case "get_pipeline_status": {
        // Alineado con la vista Pipeline: usa el pipeline que el usuario tiene abierto.
        const wanted = (args.pipeline_id as string | undefined) || uiPipelineId || null;
        let p: { id: string; name: string } | null = null;
        if (wanted) {
          const { data } = await sb.from("pipelines").select("id, name")
            .eq("tenant_id", tenantId).eq("id", wanted).maybeSingle();
          p = (data as any) ?? null;
        }
        if (!p) {
          const { data } = await sb
            .from("pipelines")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .order("is_default", { ascending: false })
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
          p = (data as any) ?? null;
        }
        const pipelineId = p?.id;
        if (!pipelineId) return { ok: false, error: "Sin pipeline configurado" };

        const { data: stages } = await sb.from("pipeline_stages")
          .select("id, name, position").eq("pipeline_id", pipelineId)
          .order("position", { ascending: true });
        const stageIds = (stages ?? []).map((s: any) => s.id);
        if (!stageIds.length) return { ok: true, pipeline_id: pipelineId, open: 0, won: 0, lost: 0, open_amount: 0 };

        const { data: deals } = await sb
          .from("deals")
          .select("id, amount, is_won, is_lost, stage_id")
          .eq("tenant_id", tenantId)
          .in("stage_id", stageIds);

        const summary = { open: 0, won: 0, lost: 0, open_amount: 0 };
        const byStage = new Map<string, { stage: string; count: number; amount: number }>();
        for (const st of stages ?? []) byStage.set(st.id, { stage: st.name, count: 0, amount: 0 });
        for (const d of deals ?? []) {
          const row = byStage.get(d.stage_id);
          if (row) { row.count++; row.amount += Number(d.amount ?? 0); }
          if (d.is_won) summary.won++;
          else if (d.is_lost) summary.lost++;
          else { summary.open++; summary.open_amount += Number(d.amount ?? 0); }
        }
        return {
          ok: true,
          pipeline_id: pipelineId,
          pipeline_name: p?.name,
          ...summary,
          by_stage: [...byStage.values()],
          note: "Conteo del pipeline activo del usuario, sin filtros ni búsqueda de la pantalla.",
        };
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
        const [{ data: ctx }, { data: events }, { data: contact }, { data: dealRows }] = await Promise.all([
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
          // Oportunidades del contacto (abiertas, ganadas y perdidas) para que el
          // copiloto nunca reporte "sin oportunidades" cuando sí existen.
          sb.from("deals")
            .select("id, name, amount, is_won, is_lost, won_at, created_at, expected_close_date, stage_id, pipeline_stages(name)")
            .eq("contact_id", id)
            .order("created_at", { ascending: false }).limit(25),
        ]);
        const deals = (dealRows ?? []).map((d: any) => ({
          id: d.id,
          name: d.name,
          amount: d.amount,
          status: d.is_won ? "ganada" : d.is_lost ? "perdida" : "abierta",
          stage: d.pipeline_stages?.name ?? null,
          won_at: d.won_at,
          created_at: d.created_at,
          expected_close_date: d.expected_close_date,
        }));
        return { ok: true, contact, context: ctx ?? null, recent_events: events ?? [], deals, deals_count: deals.length };
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

      case "mark_deal_won": {
        const now = new Date();
        let wonAt = now;
        if (args.won_date) {
          const parsed = new Date(`${String(args.won_date).slice(0, 10)}T23:59:00`);
          if (isNaN(parsed.getTime())) return { ok: false, error: "Fecha inválida (usa YYYY-MM-DD)" };
          wonAt = parsed > now ? now : parsed;
        }
        const { data: wonStage } = await sb.from("pipeline_stages")
          .select("id, name").eq("tenant_id", tenantId).eq("is_won", true)
          .order("position", { ascending: true }).limit(1).maybeSingle();
        const patch: Record<string, any> = {
          is_won: true, is_lost: false, probability: 100, won_at: wonAt.toISOString(),
        };
        if (wonStage?.id) { patch.stage_id = wonStage.id; patch.stage_name = wonStage.name; }
        // La fecha puede ser del pasado. Si es anterior a la creación, movemos la
        // fecha de creación a un día antes y avisamos al usuario.
        let createdAdjusted: string | null = null;
        const { data: cur } = await sb.from("deals")
          .select("created_at").eq("id", args.deal_id).maybeSingle();
        if (cur?.created_at && new Date(cur.created_at) > wonAt) {
          createdAdjusted = new Date(wonAt.getTime() - 86400000).toISOString();
          patch.created_at = createdAdjusted;
        }
        const { data, error } = await sb.from("deals")
          .update(patch).eq("id", args.deal_id)
          .select("id, name, amount, stage_name, won_at, created_at").single();
        if (error) return { ok: false, error: error.message };
        await sb.from("ai_memory_events").insert({
          tenant_id: tenantId, entity_type: "deal", entity_id: args.deal_id,
          event_type: "deal_won", event_data: { won_at: wonAt.toISOString(), by: "copilot" },
          actor_id: userId,
        });
        return {
          ok: true,
          deal: data,
          created_at_adjusted: createdAdjusted,
          warning: createdAdjusted
            ? `La fecha de cierre era anterior a la creación de la oportunidad; se ajustó la fecha de creación a ${createdAdjusted.slice(0, 10)} (un día antes). Avísale al usuario.`
            : undefined,
        };
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

      case "get_scheduled_services": {
        const off = Number.isFinite(Number(args.month_offset)) ? Number(args.month_offset) : 0;
        const base = new Date();
        const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + off, 1));
        const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const STATUS_ES: Record<string, string> = {
          pending: "Por contactar",
          price_accepted: "Precio aceptado",
          scheduled: "Agendado",
          executed: "Ejecutado",
          postponed: "Pospuesto",
          skipped: "No procede",
        };
        const { data: occs } = await sb
          .from("recurrence_occurrences")
          .select("due_date, status, scheduled_at, price_quoted, recurrence_definitions(name), recurrence_subscriptions(contact_id, contacts(name, phone))")
          .eq("tenant_id", tenantId)
          .gte("due_date", iso(from))
          .lt("due_date", iso(to))
          .order("due_date")
          .limit(300);
        let rows = (occs ?? []) as any[];
        if (args.type) {
          const t = String(args.type).toLowerCase();
          rows = rows.filter((r) => (r.recurrence_definitions?.name ?? "").toLowerCase().includes(t));
        }
        const pendientes = rows.filter((r) => r.status === "pending" || r.status === "price_accepted").length;
        return {
          mes: from.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }),
          total: rows.length,
          por_contactar: pendientes,
          servicios: rows.slice(0, 60).map((r) => ({
            cliente: r.recurrence_subscriptions?.contacts?.name ?? "Sin nombre",
            telefono: r.recurrence_subscriptions?.contacts?.phone ?? null,
            servicio: r.recurrence_definitions?.name ?? "Servicio",
            mes_programado: r.due_date,
            estado: STATUS_ES[r.status] ?? r.status,
            fecha_agendada: r.scheduled_at ?? null,
            precio: r.price_quoted ?? null,
            contact_id: r.recurrence_subscriptions?.contact_id ?? null,
          })),
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
          .eq("completed", false);
        const { data: rolesRowsT } = await sb.from("user_roles").select("role").eq("user_id", userId);
        const isAdminT = (rolesRowsT ?? []).some((r: any) =>
          ["tenant_owner", "tenant_admin", "org_owner", "platform_owner", "platform_staff"].includes(r.role));
        const scopeT = args.scope ?? (isAdminT ? "tenant" : "mine");
        if (scopeT === "mine") q = q.eq("assignee_id", userId);

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

      case "get_activities": {
        // Rango de fechas: date_from/date_to ganan sobre period.
        const now = new Date();
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const period = String(args.period ?? "semana").toLowerCase();
        let from: Date;
        let to: Date;
        if (period === "hoy") {
          from = startOfDay(now);
          to = new Date(from.getTime() + 86400000);
        } else if (period === "ayer") {
          to = startOfDay(now);
          from = new Date(to.getTime() - 86400000);
        } else if (period === "mes") {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else if (period === "mes_pasado") {
          from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          to = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
          // semana / semana_pasada: semana que inicia en lunes
          const dow = (now.getDay() + 6) % 7;
          const monday = new Date(startOfDay(now).getTime() - dow * 86400000);
          if (period === "semana_pasada") {
            from = new Date(monday.getTime() - 7 * 86400000);
            to = monday;
          } else {
            from = monday;
            to = new Date(monday.getTime() + 7 * 86400000);
          }
        }
        if (args.date_from) from = new Date(`${String(args.date_from).slice(0, 10)}T00:00:00`);
        if (args.date_to) to = new Date(new Date(`${String(args.date_to).slice(0, 10)}T00:00:00`).getTime() + 86400000);

        const { data: rolesAct } = await sb.from("user_roles").select("role").eq("user_id", userId);
        const isAdminAct = (rolesAct ?? []).some((r: any) =>
          ["tenant_owner", "tenant_admin", "org_owner", "platform_owner", "platform_staff"].includes(r.role));
        const scopeAct = args.scope ?? (isAdminAct ? "tenant" : "mine");

        let qa = sb
          .from("activities")
          .select("id, type, description, occurred_at, agent_id, contact_id, deal_id, metadata, contacts(name)")
          .eq("tenant_id", tenantId)
          .gte("occurred_at", from.toISOString())
          .lt("occurred_at", to.toISOString());
        if (scopeAct === "mine") qa = qa.eq("agent_id", userId);
        const { data: acts, error: actErr } = await qa
          .order("occurred_at", { ascending: false })
          .limit(Math.min(200, Number(args.limit ?? 100)));
        if (actErr) return { ok: false, error: actErr.message };

        let rowsAct = (acts ?? []) as any[];
        if (args.kind) {
          const k = String(args.kind).toLowerCase();
          rowsAct = rowsAct.filter((a) => {
            const label = String(a.metadata?.activity_kind_label ?? "").toLowerCase();
            const kind = String(a.metadata?.activity_kind ?? "").toLowerCase();
            return label.includes(k) || kind.includes(k) || String(a.type ?? "").toLowerCase().includes(k);
          });
        }
        const actorIds = [...new Set(rowsAct.map((a) => a.agent_id).filter(Boolean))];
        const actors = actorIds.length
          ? (await sb.from("profiles").select("id, full_name, email").in("id", actorIds)).data ?? []
          : [];
        const aMap = new Map(actors.map((p: any) => [p.id, p.full_name ?? p.email]));
        const byKind: Record<string, number> = {};
        const listAct = rowsAct.map((a) => {
          const label = a.metadata?.activity_kind_label ?? a.type;
          byKind[label] = (byKind[label] ?? 0) + 1;
          return {
            fecha: a.occurred_at,
            tipo: label,
            resultado: a.metadata?.result ?? null,
            contacto: a.contacts?.name ?? null,
            contact_id: a.contact_id,
            deal_id: a.deal_id,
            usuario: a.agent_id ? aMap.get(a.agent_id) ?? null : null,
            nota: a.description ?? null,
          };
        });
        return {
          ok: true,
          desde: from.toISOString().slice(0, 10),
          hasta: new Date(to.getTime() - 1).toISOString().slice(0, 10),
          scope: scopeAct,
          total: listAct.length,
          por_tipo: byKind,
          actividades: listAct,
        };
      }

      case "get_my_deals": {
        const limit = Math.min(50, Number(args.limit ?? 10));
        // Detectar si el usuario es admin/owner para default de scope
        const { data: rolesRows } = await sb.from("user_roles")
          .select("role").eq("user_id", userId);
        const isAdmin = (rolesRows ?? []).some((r: any) =>
          ["tenant_owner", "tenant_admin", "org_owner", "platform_owner", "platform_staff"].includes(r.role));
        const scope = args.scope ?? (isAdmin ? "tenant" : "mine");
        let q = sb.from("deals")
          .select("id, name, amount, stage_name, contact_id, owner_id, expected_close_date, updated_at")
          .eq("tenant_id", tenantId)
          .eq("is_won", false)
          .eq("is_lost", false);
        if (scope === "mine") q = q.eq("owner_id", userId);
        if (args.closing_this_month) {
          const now = new Date();
          const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
          q = q.gte("expected_close_date", first).lte("expected_close_date", last);
        }
        const { data, error } = await q.order("amount", { ascending: false }).limit(limit);
        if (error) return { ok: false, error: error.message };
        const deals = data ?? [];
        const ownerIds = [...new Set(deals.map((d: any) => d.owner_id).filter(Boolean))];
        const owners = ownerIds.length
          ? (await sb.from("profiles").select("id, full_name, email").in("id", ownerIds)).data ?? []
          : [];
        const oMap = new Map(owners.map((o: any) => [o.id, o.full_name ?? o.email]));
        const enriched = deals.map((d: any) => ({ ...d, owner_name: d.owner_id ? oMap.get(d.owner_id) ?? null : null }));
        const totalAmount = enriched.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
        return { ok: true, scope, count: enriched.length, total_amount: totalAmount, deals: enriched };
      }

      case "get_profitability":
      case "get_expenses_summary":
      case "get_monthly_goal":
      case "get_run_rate":
      case "get_team_performance": {
        const now = new Date();
        const year = Number(args.year ?? now.getFullYear());
        const month = Number(args.month ?? (now.getMonth() + 1));
        const first = new Date(year, month - 1, 1);
        const last = new Date(year, month, 0);
        const firstIso = first.toISOString().slice(0, 10);
        const lastIso = last.toISOString().slice(0, 10);

        // Ventas ganadas del mes (por fecha de cierre esperada o actualización si is_won)
        const wonDeals = await sb.from("deals")
          .select("id, name, amount, deal_type, owner_id, updated_at, expected_close_date")
          .eq("tenant_id", tenantId).eq("is_won", true)
          .gte("updated_at", first.toISOString())
          .lte("updated_at", new Date(last.getTime() + 86400000 - 1).toISOString());
        const won = wonDeals.data ?? [];
        const revenue = won.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);

        if (name === "get_team_performance") {
          const byOwner = new Map<string, { count: number; amount: number }>();
          for (const d of won) {
            const k = d.owner_id ?? "sin_asignar";
            const cur = byOwner.get(k) ?? { count: 0, amount: 0 };
            cur.count++; cur.amount += Number(d.amount ?? 0);
            byOwner.set(k, cur);
          }
          const ownerIds = [...byOwner.keys()].filter((k) => k !== "sin_asignar");
          const owners = ownerIds.length
            ? (await sb.from("profiles").select("id, full_name, email").in("id", ownerIds)).data ?? []
            : [];
          const map = new Map(owners.map((o: any) => [o.id, o.full_name ?? o.email]));
          const rows = [...byOwner.entries()]
            .map(([id, v]) => ({ owner_id: id, owner_name: map.get(id) ?? "Sin asignar", ...v }))
            .sort((a, b) => b.amount - a.amount);
          return { ok: true, year, month, team: rows, total_amount: revenue, total_deals: won.length };
        }

        if (name === "get_monthly_goal") {
          const { data: goals } = await sb.from("monthly_goals")
            .select("amount, metric, dimension, dimension_value_text, notes, is_draft")
            .eq("tenant_id", tenantId).eq("period_year", year).eq("period_month", month);
          const rows = (goals ?? []).filter((g: any) => !g.is_draft);
          const amounts = rows.filter((g: any) => (g.metric ?? "amount") === "amount");
          const global = amounts.find((g: any) => g.dimension === "global");
          const by_type: Record<string, number> = { venta: 0, servicio: 0, refaccion: 0 };
          for (const g of amounts.filter((g: any) => g.dimension === "deal_type")) {
            const t = String(g.dimension_value_text ?? "");
            if (t in by_type) by_type[t] += Number(g.amount ?? 0);
          }
          const monthly_goal_total = global
            ? Number(global.amount ?? 0)
            : amounts.filter((g: any) => g.dimension !== "global")
                .reduce((s: number, g: any) => s + Number(g.amount ?? 0), 0);
          return {
            ok: true, year, month, source: "monthly_goals",
            monthly_goal_total, monthly_goal_by_type: by_type,
            goals: rows.map((g: any) => ({
              dimension: g.dimension, metric: g.metric, value: Number(g.amount ?? 0),
              dimension_value: g.dimension_value_text,
            })),
          };
        }

        if (name === "list_widgets" || name === "set_widget_visibility") {
          const surface = String(args.surface ?? "dashboard") === "mi_dia" ? "mi_dia" : "dashboard";
          const { data: catalog, error: catErr } = await sb
            .from("dashboard_widgets")
            .select("key, name, description, is_mandatory, is_active, default_position, tenant_id")
            .eq("surface", surface)
            .eq("is_active", true)
            .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
          if (catErr) return { ok: false, error: catErr.message };
          const widgets = (catalog ?? []).sort(
            (a: any, b: any) => Number(a.default_position ?? 0) - Number(b.default_position ?? 0),
          );

          const { data: layoutRow } = await sb
            .from("dashboard_layouts")
            .select("items")
            .eq("tenant_id", tenantId).eq("surface", surface).eq("scope", "tenant_default")
            .maybeSingle();
          const current = new Map<string, any>(
            (((layoutRow as any)?.items ?? []) as any[]).map((i: any) => [String(i.key), i]),
          );
          const items = widgets.map((w: any, idx: number) => {
            const prev = current.get(w.key);
            return {
              key: w.key,
              position: Number(prev?.position ?? w.default_position ?? idx),
              hidden: Boolean(prev?.hidden ?? false),
            };
          });

          if (name === "list_widgets") {
            return {
              ok: true, surface,
              widgets: widgets.map((w: any) => ({
                key: w.key, name: w.name, description: w.description,
                mandatory: !!w.is_mandatory,
                visible: !(current.get(w.key)?.hidden ?? false),
              })),
            };
          }

          const norm = (t: string) =>
            String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const q = norm(args.widget);
          const match =
            widgets.find((w: any) => norm(w.key) === q) ??
            widgets.find((w: any) => norm(w.name) === q) ??
            widgets.find((w: any) => norm(w.name).includes(q) || norm(w.key).includes(q));
          if (!match) {
            return {
              ok: false,
              error: `No encontré una tarjeta llamada "${args.widget}" en ${surface}.`,
              available: widgets.map((w: any) => w.name),
            };
          }
          if (match.is_mandatory && args.visible === false) {
            return { ok: false, error: `La tarjeta "${match.name}" es obligatoria y no se puede ocultar.` };
          }
          const next = items.map((i: any) => (i.key === match.key ? { ...i, hidden: args.visible === false } : i));
          const { error: upErr } = await sb.from("dashboard_layouts").upsert(
            { tenant_id: tenantId, scope: "tenant_default", surface, items: next, updated_by: userId },
            { onConflict: "tenant_id,scope,surface" },
          );
          if (upErr) {
            const msg = String(upErr.message ?? "");
            if (msg.toLowerCase().includes("row-level security") || upErr.code === "42501") {
              return { ok: false, error: "Solo el owner o un administrador del tenant puede cambiar las tarjetas del equipo." };
            }
            return { ok: false, error: msg };
          }
          return { ok: true, surface, widget: match.name, visible: args.visible !== false, scope: "equipo" };
        }

        if (name === "set_monthly_goal") {
          if (args.confirmed !== true) {
            return { ok: false, error: "Falta confirmación del usuario. Pregunta y confirma monto y mes antes de reintentar con confirmed=true." };
          }
          const total = Number(args.total);
          if (!Number.isFinite(total) || total < 0) {
            return { ok: false, error: "Monto inválido." };
          }
          const { data: existing } = await sb.from("monthly_goals")
            .select("id")
            .eq("tenant_id", tenantId).eq("period_year", year).eq("period_month", month)
            .eq("dimension", "global").eq("metric", "amount").maybeSingle();
          const payload = {
            tenant_id: tenantId,
            period_year: year,
            period_month: month,
            dimension: "global",
            metric: "amount",
            amount: total,
            notes: args.note ?? null,
            is_draft: false,
          };
          const q = existing
            ? sb.from("monthly_goals").update(payload).eq("id", existing.id)
            : sb.from("monthly_goals").insert(payload);
          const { data: inserted, error } = await q
            .select("id, period_year, period_month, amount, dimension, metric").single();
          if (error) {
            const msg = String(error.message ?? "");
            if (msg.includes("metas de meses pasados") || error.code === "23514") {
              return { ok: false, error: "No se puede modificar la meta de un mes pasado." };
            }
            if (msg.toLowerCase().includes("row-level security") || error.code === "42501") {
              return { ok: false, error: "Solo administradores del tenant pueden ajustar la meta." };
            }
            return { ok: false, error: msg };
          }
          return { ok: true, updated: inserted };
        }

        // Gastos del periodo
        const statusFilter = String(args.status ?? "confirmed");
        let expQ = sb.from("expenses")
          .select("id, amount, kind, category_id, status, description, incurred_at")
          .eq("tenant_id", tenantId)
          .gte("incurred_at", firstIso).lte("incurred_at", lastIso);
        if (statusFilter !== "all") expQ = expQ.eq("status", statusFilter);
        const { data: exps } = await expQ;
        const expenses = exps ?? [];
        const totalExp = expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
        const fixed = expenses.filter((e: any) => e.kind === "fijo").reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
        const variable = totalExp - fixed;

        if (name === "get_expenses_summary") {
          const catIds = [...new Set(expenses.map((e: any) => e.category_id).filter(Boolean))];
          const cats = catIds.length
            ? (await sb.from("expense_categories").select("id, name").in("id", catIds)).data ?? []
            : [];
          const catMap = new Map(cats.map((c: any) => [c.id, c.name]));
          const byCat = new Map<string, number>();
          for (const e of expenses) {
            const k = catMap.get(e.category_id) ?? "Sin categoría";
            byCat.set(k, (byCat.get(k) ?? 0) + Number(e.amount ?? 0));
          }
          const rows = [...byCat.entries()]
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);
          return {
            ok: true, year, month, status: statusFilter,
            total: totalExp, fijo: fixed, variable, by_category: rows, count: expenses.length,
          };
        }

        if (name === "get_profitability") {
          const profit = revenue - totalExp;
          const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
          const status = margin >= 25 ? "saludable" : margin >= 10 ? "en_vigilancia" : "en_riesgo";
          return {
            ok: true, year, month,
            revenue, expenses_total: totalExp, expenses_fijo: fixed, expenses_variable: variable,
            profit, margin_percent: margin, status,
            deals_won: won.length,
          };
        }

        // get_run_rate (siempre mes actual)
        const today = new Date();
        const dayOfMonth = today.getDate();
        const daysInMonth = last.getDate();
        const { data: goalRows } = await sb.from("monthly_goals")
          .select("amount, metric, dimension, is_draft")
          .eq("tenant_id", tenantId).eq("period_year", year).eq("period_month", month);
        const amountRows = (goalRows ?? []).filter(
          (g: any) => !g.is_draft && (g.metric ?? "amount") === "amount",
        );
        const globalRow = amountRows.find((g: any) => g.dimension === "global");
        const goalTotal = globalRow
          ? Number(globalRow.amount ?? 0)
          : amountRows.filter((g: any) => g.dimension !== "global")
              .reduce((s: number, g: any) => s + Number(g.amount ?? 0), 0);
        const daily = dayOfMonth > 0 ? revenue / dayOfMonth : 0;
        const projected = Math.round(daily * daysInMonth);
        const percentVsGoal = goalTotal > 0 ? Math.round((projected / goalTotal) * 1000) / 10 : 0;
        const status2 = percentVsGoal >= 100 ? "en_ruta" : percentVsGoal >= 80 ? "cerca" : percentVsGoal >= 60 ? "riesgo" : "critico";
        return {
          ok: true, year, month, day_of_month: dayOfMonth, days_in_month: daysInMonth,
          revenue_mtd: revenue, daily_avg: Math.round(daily),
          projected_month_end: projected, goal_total: goalTotal,
          percent_vs_goal: percentVsGoal, status: status2, deals_won: won.length,
        };
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
    "  • 'qué oportunidades hay este mes', 'deals del negocio/equipo' → llama `get_my_deals` con scope='tenant' y closing_this_month=true.",
    "  • 'cómo va mi pipeline', 'cuánto tengo en curso' → llama `get_pipeline_status`.",
    "  • 'rentabilidad', 'margen', 'utilidad', 'gané o perdí', 'cuánto neto' → llama `get_profitability`.",
    "  • 'run rate', 'voy bien', 'llego a la meta', 'pronóstico', 'proyección del mes' → llama `get_run_rate`.",
    "  • 'mis gastos', 'en qué gasto', 'gastos fijos/variables', 'gasto por categoría' → llama `get_expenses_summary`.",
    "  • 'mi meta', 'cuál es la meta', 'meta del mes' → llama `get_monthly_goal`.",
    "  • 'ajusta la meta', 'cambia la meta a', 'pon la meta en', 'sube/baja la meta' → confirma monto y mes con el usuario y luego llama `set_monthly_goal` con confirmed=true. Nunca la llames en el primer turno; primero repite '¿Confirmas ajustar la meta de <mes> <año> a $<monto>?'.",
    "  • 'quién vendió más', 'ranking vendedores', 'rendimiento del equipo' → llama `get_team_performance`.",
    "  • 'oculta/quita/muestra la tarjeta X del dashboard o de Mi Día', 'no quiero ver Rentabilidad' → llama `list_widgets` si dudas del nombre y luego `set_widget_visibility` (aplica a todo el equipo; solo owner/admin).",
    "  • 'cómo hago...', 'dónde está...', 'para qué sirve...', 'no sé usar Walix', 'enséñame', '¿qué puedo hacer aquí?' → llama `get_help_topic` (MODO TUTOR).",
    "Siempre intenta con las tools ANTES de responder que no puedes. Solo di que no hay información si la tool devolvió 0 resultados.",
    "",
    "MODO TUTOR / GUÍA (además de todas tus capacidades):",
    "También eres el tutor de Walix.ai: enseñas a usar el CRM paso a paso, en lenguaje simple, sin tecnicismos.",
    "Reglas del modo tutor:",
    "  1) Nunca inventes pantallas, botones o rutas: usa SIEMPRE `get_help_topic` y apóyate solo en lo que devuelva.",
    "  2) Responde con: una frase de qué es, luego 2-4 pasos numerados cortos, y termina con la ruta del menú (ej: 'Configuración → Metas').",
    "  3) Si el usuario puede hacerlo contigo, ofrécelo: '¿Quieres que lo haga yo ahora?' y ejecuta con las tools cuando confirme.",
    "  4) Adapta el nivel: si el usuario es nuevo o se ve perdido, propón el siguiente paso concreto ('empieza por registrar tu meta del mes').",
    "  5) Si la duda mezcla datos y aprendizaje ('¿cómo va mi pipeline y cómo lo uso?'), llama en el mismo turno la tool de datos y `get_help_topic`.",
    "  6) Termina las explicaciones largas con UNA sugerencia de qué aprender o hacer después.",
    "El modo tutor NO amplía el guardrail de temas: sigues hablando solo del negocio del tenant y de cómo usar Walix.",
    "",
    "GUARDRAIL DE TEMAS (obligatorio):",
    `Solo puedes hablar sobre: (a) la operación del negocio del tenant "${tenant?.brand_name ?? tenant?.name ?? "actual"}" (ventas, contactos, deals, pipeline, tareas, gastos, rentabilidad, metas, equipo, WhatsApp del CRM), (b) cómo usar Walix.ai y sus funciones.`,
    "Si el usuario pregunta cualquier otra cosa (política, deportes, cultura general, chistes, programación fuera del CRM, consejos personales, otros negocios, etc.) responde con UNA sola frase amable en español:",
    "  \"Solo puedo ayudarte con la operación de tu negocio en Walix. ¿Quieres que revise tus pendientes, ventas o rentabilidad?\"",
    "No inventes datos: si no tienes una tool para responder algo del negocio, dilo claramente y sugiere qué sí puedes hacer.",
    "",
    "REGLA DE ORO INVIOLABLE:",
    "Cuando el usuario pida enviar un WhatsApp, NUNCA llames otra cosa que no sea `prepare_whatsapp_message`.",
    "El humano siempre confirma y envía. Tú solo redactas el borrador.",
    "",
    "CAMBIOS MASIVOS (solo dueño del Tenant) — protocolo obligatorio de 3 confirmaciones:",
    "Detecta pedidos como 'a todas las oportunidades X cámbiales el monto a $3400', 'reasigna todos los contactos de Juan a Ana', 'borra las oportunidades de este contacto', 'resetea/borra toda la actividad que registró Norma'.",
    "  0) Si el pedido menciona a una persona del equipo, llama `list_team_members` para su id exacto (owner_id). Si menciona un CONTACTO, puedes pasar directamente contact_name; si el usuario pegó una URL /contacts/<uuid>, usa ese uuid como contact_id.",
    "  1) Llama `bulk_preview` con los filtros y los campos a cambiar (o mode='delete' para borrar actividades, tareas u oportunidades). NO modifica nada. Hazlo en el MISMO turno en que el usuario lo pide: la vista previa es segura.",
    "  2) Muestra al usuario: los filtros interpretados (filters_used), cuántos registros, qué cambia exactamente y la lista de ejemplos. Si won_count > 0 advierte que esas oportunidades están GANADAS y afectan ingresos y metas, y pregunta si las incluye. Pregunta: '¿Confirmas aplicar este cambio a N registros?'.",
    "  3) Si dice que sí, llama `bulk_confirm` y pídele que escriba el código de 6 dígitos que te devuelva. Muéstrale el código tal cual.",
    "  4) Solo cuando el usuario ESCRIBA ese código, llama `bulk_apply` con ese código exacto. Nunca lo inventes ni lo asumas.",
    "  5) Al terminar, informa EXACTAMENTE el applied_count que devolvió `bulk_apply` (nunca digas 'listo' sin ese número). Si viene remaining_count > 0, dilo claramente: quedaron registros sin borrar. Recuérdale que puede revertirlo diciendo 'revertir el último cambio masivo' (`bulk_list` + `bulk_undo`).",
    "Si una tool de bulk devuelve ok:false, NO digas que se hizo: explica el error tal cual y propone cómo corregirlo (por ejemplo, elegir entre los contactos que te listó).",
    "NUNCA afirmes que algo se borró o cambió si no llamaste `bulk_apply` y recibiste ok:true. Una vista previa (`bulk_preview`) no modifica nada.",
    "En BORRADOS avisa siempre que se guarda respaldo y que se puede restaurar con `bulk_undo`. Puedes borrar actividades, tareas y oportunidades; nunca borres contactos.",
    "Si la tool responde que solo el dueño del Tenant puede hacerlo, explícalo con amabilidad y no insistas.",
    "Nunca hagas un cambio masivo sin filtros. La vista previa sí puede ir en el mismo turno; la EJECUCIÓN nunca sin el código escrito por el usuario.",

    "",
    "PREGUNTA ANTES DE ACTUAR (obligatorio):",
    "Antes de ejecutar cualquier acción que ESCRIBA o BORRE datos (crear/mover/editar deals, tareas, contactos, metas, fechas de ganado, widgets, cambios masivos), verifica que entendiste bien. Si algo es ambiguo, haz 1-2 preguntas cortas con opciones concretas ANTES de ejecutar.",
    "Casos en los que SIEMPRE debes preguntar primero:",
    "  • El nombre de un contacto/deal/persona coincide con varios registros o no es exacto → lista los candidatos y pide que elija.",
    "  • Falta un dato clave (monto, fecha, etapa, categoría, dueño) o el usuario usó términos vagos ('ese', 'el último', 'todos los de la semana').",
    "  • La acción afecta ingresos, metas o histórico (oportunidades GANADAS, fechas de cierre, borrados) → confirma alcance exacto y advierte el impacto.",
    "  • El usuario pide una fecha de ganado ANTERIOR a la creación del deal → avísale que la fecha de creación se recorrerá a un día antes y pide confirmación.",
    "  • El pedido puede interpretarse de 2 formas (ej. 'borra las oportunidades de X': ¿solo abiertas o también las cobradas?) → di las dos lecturas y pregunta cuál.",
    "Regla práctica: LEER datos nunca requiere preguntar (consulta primero con las tools y usa esa información para preguntar mejor). ESCRIBIR o BORRAR sí, siempre que quede alguna duda.",
    "No preguntes de más: si el pedido es claro y específico, ejecútalo. Máximo 2 preguntas por turno, cortas y con opciones sugeridas.",
    "Después de ejecutar, resume en una línea qué cambió exactamente (con números y fechas reales devueltos por la tool) y menciona cualquier campo `warning` que venga en la respuesta.",
    "",

    "Cuando uses tools, encadénalas si hace falta (ej: search_contacts → get_contact_context → create_deal → prepare_whatsapp_message).",
    "AGILIDAD (obligatorio): pide en el MISMO turno todas las tools que sean independientes entre sí (se ejecutan en paralelo). Si el usuario pide varias cosas ('cómo voy y qué pendientes tengo'), resuélvelas todas de una vez.",
    "No pidas datos que puedes deducir o consultar con una tool. Si falta un dato imprescindible, haz UNA sola pregunta corta con opciones.",
    "Sé breve: respuesta directa primero (1-2 frases con la cifra o el hecho clave), luego máximo 3 viñetas y, si aplica, una acción sugerida. Nada de introducciones ni disculpas.",
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

    // Motor de IA asignado a este tenant por la plataforma
    const engine = await resolveTenantModel(sb, tenantId);
    const MODEL = engine.model || FALLBACK_MODEL;

    const body = await req.json() as {
      message: string;
      conversationKey?: string;
      entityType?: string | null;
      entityId?: string | null;
      historyLimit?: number;
      uiPipelineId?: string | null;
    };
    if (!body.message?.trim()) return json({ error: "Mensaje vacío" }, 400);

    const sessionId = body.conversationKey ?? "global";
    const historyLimit = Math.min(40, body.historyLimit ?? 14);

    // 1 + 2. Historial y contexto del sistema en paralelo (menor latencia)
    const [{ data: prevHistory }, systemPrompt] = await Promise.all([
      sb.from("ai_conversation_history")
        .select("role, content, tool_calls")
        .eq("user_id", userId).eq("session_id", sessionId)
        .order("created_at", { ascending: false }).limit(historyLimit),
      buildSystemPrompt(sb, tenantId, userId, body.entityType ?? null, body.entityId ?? null),
    ]);
    const history = (prevHistory ?? []).reverse();
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

    // 3. Persistir mensaje del usuario (no bloquea la respuesta)
    const pendingWrites: Promise<any>[] = [];
    const t0 = Date.now();
    let writeSeq = 0;
    const stamp = () => new Date(t0 + writeSeq++).toISOString();
    pendingWrites.push(sb.from("ai_conversation_history").insert({
      tenant_id: tenantId, user_id: userId, session_id: sessionId,
      role: "user", content: body.message, created_at: stamp(),
    }) as unknown as Promise<any>);

    // 4. Loop agéntico
    const toolsUsed: { name: string; args: any; result: any }[] = [];
    // Capacidades nativas apagadas por el tenant (Ajustes → Copiloto).
    const disabledCaps = await getDisabledNativeTools(sb, tenantId);
    const ACTIVE_TOOLS = filterTools(CRM_TOOLS as any[], disabledCaps);
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
          tools: ACTIVE_TOOLS,
          tool_choice: "auto",
          parallel_tool_calls: true,
        }),
      });

      if (aiRes.status === 429) return json({ text: "⏳ Demasiadas solicitudes seguidas. Intenta de nuevo en unos segundos.", toolsUsed: [] }, 200);
      if (aiRes.status === 402 || aiRes.status === 403) {
        const t = await aiRes.text().catch(() => "");
        console.error("[ai-copilot] credits/permission", aiRes.status, t.slice(0, 300));
        return json({ text: "⚠️ El asistente de IA está presentando actualizaciones de IA en este momento. Notifica al administrador de Walix", toolsUsed: [] }, 200);
      }
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
          body: JSON.stringify({ model: MODEL, messages, tools: ACTIVE_TOOLS, tool_choice: "auto" }),
        });
      }
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("[ai-copilot] gateway error", aiRes.status, t);
        if (/credit_limit_reached|insufficient/i.test(t)) {
          return json({ text: "⚠️ El asistente de IA está presentando actualizaciones de IA en este momento. Notifica al administrador de Walix", toolsUsed: [] }, 200);
        }
        return json({ text: "⚠️ El asistente no pudo responder en este momento. Intenta de nuevo en unos segundos.", toolsUsed: [] }, 200);
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
        pendingWrites.push(sb.from("ai_conversation_history").insert({
          tenant_id: tenantId, user_id: userId, session_id: sessionId,
          role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls, created_at: stamp(),
        }) as unknown as Promise<any>);

        // Ejecutar todas las herramientas del turno en paralelo
        const executed = await Promise.all(msg.tool_calls.map(async (tc: any) => {
          let parsedArgs: any = {};
          try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* noop */ }
          const result = await executeTool(tc.function.name, parsedArgs, sb, tenantId, userId, body.uiPipelineId ?? null);
          return { tc, parsedArgs, result };
        }));
        const toolRows: any[] = [];
        for (const { tc, parsedArgs, result } of executed) {
          toolsUsed.push({ name: tc.function.name, args: parsedArgs, result });
          if (tc.function.name === "prepare_whatsapp_message" && result?.ok) {
            pendingWhatsapp = result.pending_whatsapp;
          }
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          toolRows.push({
            tenant_id: tenantId, user_id: userId, session_id: sessionId,
            role: "tool", content: JSON.stringify(result),
            tool_calls: { tool_call_id: tc.id, name: tc.function.name }, created_at: stamp(),
          });
        }
        if (toolRows.length) {
          pendingWrites.push(sb.from("ai_conversation_history").insert(toolRows) as unknown as Promise<any>);
        }
        continue; // re-llamar al modelo
      }

      finalText = msg.content ?? "";
      pendingWrites.push(sb.from("ai_conversation_history").insert({
        tenant_id: tenantId, user_id: userId, session_id: sessionId,
        role: "assistant", content: finalText, created_at: stamp(),
      }) as unknown as Promise<any>);
      break;
    }

    // Asegurar que el historial quedó persistido antes de responder
    try { await Promise.all(pendingWrites); } catch (e) { console.error("[ai-copilot] history write", e); }

    // Bitácora de uso + consumo de créditos del periodo (rol de servicio)
    await recordAiUsage({
      tenantId,
      userId,
      surface: "copilot",
      model: MODEL,
      inputTokens: usageInput,
      outputTokens: usageOutput,
      totalTokens: usageTotal,
      iterations: usageIters,
      creditFactor: engine.creditFactor,
    });

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