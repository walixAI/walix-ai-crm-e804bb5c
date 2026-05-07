// Edge Function: ai-agent-runner
// Ejecuta un agente autónomo de Walix. Invocado por pg_cron (dispatcher) o
// manualmente por un admin del tenant. Usa service-role para operar en nombre
// del sistema, respetando el max_actions_per_run del agente.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import parser from "npm:cron-parser@4.9.0";
import { runAgenticLoop } from "../_shared/ai-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nextRunFromCron(expr: string): string | null {
  try {
    const it = parser.parseExpression(expr, { tz: "America/Mexico_City" });
    return it.next().toDate().toISOString();
  } catch {
    return null;
  }
}

function isSameDayCDMX(a: string | null, b: Date): boolean {
  if (!a) return false;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return fmt(new Date(a)) === fmt(b);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = auth.slice(7);

    // Authorization: either service-role (dispatcher) or admin/owner of the tenant.
    const isService = token === SERVICE_ROLE;
    const body = await req.json() as { agent_id: string; tenant_id?: string };
    if (!body.agent_id) return json({ error: "agent_id required" }, 400);

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    if (!isService) {
      // verify caller is admin of the tenant of this agent
      const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: u } = await sbUser.auth.getUser();
      if (!u?.user) return json({ error: "unauthorized" }, 401);
      const { data: agent } = await sbAdmin.from("ai_agents").select("tenant_id").eq("id", body.agent_id).maybeSingle();
      if (!agent) return json({ error: "agent not found" }, 404);
      const { data: roles } = await sbAdmin.from("user_roles")
        .select("role").eq("user_id", u.user.id).eq("tenant_id", agent.tenant_id);
      const ok = (roles ?? []).some((r: any) => r.role === "tenant_admin" || r.role === "tenant_owner");
      if (!ok) return json({ error: "forbidden" }, 403);
    }

    // ───── Load agent ─────
    const { data: agent, error: agentErr } = await sbAdmin.from("ai_agents")
      .select("*").eq("id", body.agent_id).maybeSingle();
    if (agentErr || !agent) return json({ error: "agent not found" }, 404);
    if (!agent.is_active) return json({ ok: true, skipped: "inactive" });

    const tenantId = agent.tenant_id;
    const now = new Date();

    // Reset daily counter if the day changed (CDMX)
    let actionsTakenToday = agent.actions_taken_today ?? 0;
    if (!isSameDayCDMX(agent.last_run_at, now)) actionsTakenToday = 0;
    const maxActions = agent.max_actions_per_run ?? 10;

    // Create run row
    const { data: run } = await sbAdmin.from("ai_agent_runs").insert({
      agent_id: agent.id, tenant_id: tenantId, status: "running",
    }).select("id").single();
    const runId = run!.id;
    const runLog: any[] = [];
    let entitiesProcessed = 0;
    let actionsThisRun = 0;
    let suggestionsCreated = 0;
    let runStatus: "completed" | "partial" | "failed" = "completed";
    let errorMessage: string | null = null;

    try {
      const entities = await selectEntities(sbAdmin, tenantId, agent.agent_type, agent.config);
      const allowedTools: string[] = Array.isArray(agent.allowed_tools) ? agent.allowed_tools : [];

      for (const ent of entities) {
        if (actionsTakenToday + actionsThisRun >= maxActions) {
          runStatus = "partial";
          break;
        }
        const ctx = await loadEntityContext(sbAdmin, ent);
        const userMessage = buildEntityPrompt(agent.agent_type, ent, ctx);
        const ownerUserId = ent.owner_id ?? ent.user_id ?? null;

        let result;
        try {
          result = await runAgenticLoop({
            sb: sbAdmin, tenantId, userId: ownerUserId,
            systemPrompt: agent.system_prompt + `\n\nTenant ID: ${tenantId}. Hoy: ${now.toISOString()}.`,
            userMessage,
            allowedTools,
            model: agent.model || "google/gemini-2.5-flash",
            maxIterations: 3,
          });
        } catch (e) {
          runLog.push({ entity: ent, error: e instanceof Error ? e.message : String(e) });
          continue;
        }
        entitiesProcessed++;
        const writeTools = result.toolsUsed.filter(
          (t) => !t.name.startsWith("get_") && !t.name.startsWith("search_")
        );
        actionsThisRun += writeTools.length;
        suggestionsCreated += result.toolsUsed.filter(
          (t) => t.name === "create_proactive_suggestion" && t.result?.ok
        ).length;

        runLog.push({
          entity: { type: ent.entity_type, id: ent.id, label: ent.label },
          finalText: result.finalText,
          tools: result.toolsUsed.map((t) => ({ name: t.name, ok: t.result?.ok ?? false })),
        });
      }
    } catch (e) {
      runStatus = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    const completedAt = new Date().toISOString();
    await sbAdmin.from("ai_agent_runs").update({
      completed_at: completedAt, status: runStatus,
      entities_processed: entitiesProcessed, actions_taken: actionsThisRun,
      suggestions_created: suggestionsCreated, error_message: errorMessage,
      run_log: runLog,
    }).eq("id", runId);

    const nextRun = nextRunFromCron(agent.schedule);
    await sbAdmin.from("ai_agents").update({
      last_run_at: completedAt,
      last_run_status: runStatus,
      actions_taken_today: actionsTakenToday + actionsThisRun,
      next_run_at: nextRun,
    }).eq("id", agent.id);

    return json({ ok: true, run_id: runId, status: runStatus, entities_processed: entitiesProcessed, actions_taken: actionsThisRun });
  } catch (e) {
    console.error("[ai-agent-runner] fatal", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});

// ─────────────── Entity selectors ───────────────

interface EntityRef {
  id: string;
  entity_type: "deal" | "contact" | "user";
  label: string;
  owner_id?: string | null;
  user_id?: string | null;
  data: any;
}

async function selectEntities(sb: any, tenantId: string, agentType: string, config: any): Promise<EntityRef[]> {
  const limit = Number(config?.entity_limit ?? 50);
  switch (agentType) {
    case "followup_watchdog": {
      const cutoff = new Date(Date.now() - 5 * 86400_000).toISOString();
      const { data } = await sb.from("deals")
        .select("id, name, amount, owner_id, contact_id, stage_name, updated_at")
        .eq("tenant_id", tenantId).eq("is_won", false).eq("is_lost", false)
        .lt("updated_at", cutoff).order("updated_at", { ascending: true }).limit(limit);
      return (data ?? []).map((d: any) => ({
        id: d.id, entity_type: "deal", label: d.name, owner_id: d.owner_id, data: d,
      }));
    }
    case "lead_qualifier": {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data } = await sb.from("contacts")
        .select("id, name, last_name, phone, email, source, owner_id, created_at, status")
        .eq("tenant_id", tenantId).eq("status", "Nuevo")
        .gte("created_at", since).limit(limit);
      return (data ?? []).map((c: any) => ({
        id: c.id, entity_type: "contact", label: `${c.name} ${c.last_name ?? ""}`.trim(),
        owner_id: c.owner_id, data: c,
      }));
    }
    case "deal_risk_detector": {
      const { data: deals } = await sb.from("deals")
        .select("id, name, amount, owner_id, contact_id, stage_name, expected_close_date, updated_at")
        .eq("tenant_id", tenantId).eq("is_won", false).eq("is_lost", false)
        .or("stage_name.ilike.%propuesta%,stage_name.ilike.%negocia%")
        .limit(limit);
      return (deals ?? []).map((d: any) => ({
        id: d.id, entity_type: "deal", label: d.name, owner_id: d.owner_id, data: d,
      }));
    }
    case "morning_briefing": {
      const { data: profiles } = await sb.from("profiles")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId).eq("is_active", true).limit(limit);
      return (profiles ?? []).map((p: any) => ({
        id: p.id, entity_type: "user", label: p.full_name ?? p.email,
        user_id: p.id, owner_id: p.id, data: p,
      }));
    }
    case "weekly_coach": {
      const { data: profiles } = await sb.from("profiles")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId).eq("is_active", true).limit(limit);
      return (profiles ?? []).map((p: any) => ({
        id: p.id, entity_type: "user", label: p.full_name ?? p.email,
        user_id: p.id, owner_id: p.id, data: p,
      }));
    }
    default:
      return [];
  }
}

async function loadEntityContext(sb: any, ent: EntityRef): Promise<any> {
  if (ent.entity_type === "user") return null;
  const { data } = await sb.from("ai_entity_context")
    .select("context_summary, key_facts, sentiment, urgency_score, last_interaction")
    .eq("entity_type", ent.entity_type).eq("entity_id", ent.id).maybeSingle();
  return data;
}

function buildEntityPrompt(agentType: string, ent: EntityRef, ctx: any): string {
  const base = `Entidad: ${ent.entity_type} "${ent.label}" (id=${ent.id}).\nDatos: ${JSON.stringify(ent.data)}`;
  const ctxStr = ctx
    ? `\nContexto IA: resumen="${ctx.context_summary ?? "—"}" sentimiento=${ctx.sentiment} urgencia=${ctx.urgency_score}/100 último_contacto=${ctx.last_interaction ?? "—"}`
    : "";
  switch (agentType) {
    case "followup_watchdog":
      return `${base}${ctxStr}\n\nEste deal lleva más de 5 días sin actividad. Si confirmas el riesgo, crea una sugerencia proactiva (priority=7) dirigida al owner_id "${ent.owner_id}" con la siguiente acción concreta. Opcionalmente crea una tarea de seguimiento.`;
    case "deal_risk_detector":
      return `${base}${ctxStr}\n\nEvalúa si hay señales de enfriamiento. Si sí, crea una sugerencia proactiva de priority=8 dirigida al owner_id "${ent.owner_id}" con un plan de rescate breve.`;
    case "morning_briefing":
      return `${base}\n\nGenera el briefing matutino de este vendedor. Llama get_pipeline_status y search_contacts para informarte. Luego crea entre 1 y 3 sugerencias proactivas con priority=10, target_user_id="${ent.id}", cada una con la acción más importante del día.`;
    case "weekly_coach":
      return `${base}\n\nAnaliza el rendimiento de este vendedor en la semana anterior y crea una sugerencia proactiva de tipo coaching, target_user_id="${ent.id}", priority=6, con UNA recomendación accionable.`;
    case "lead_qualifier":
      return `${base}${ctxStr}\n\nCalifica este lead nuevo. Si parece de alta intención, crea una sugerencia proactiva (priority=8) para owner_id "${ent.owner_id}" pidiendo contacto inmediato.`;
    default:
      return base;
  }
}