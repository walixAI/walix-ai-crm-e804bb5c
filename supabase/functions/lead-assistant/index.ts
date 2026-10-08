// Asistente del lead: siguiente paso, mensajes sugeridos, resumen/alertas, guion de llamada y probabilidad.
// Se regenera solo cuando hay mensajes, actividades o cambios nuevos desde la última vez (cache por contacto).
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantModel } from "../_shared/tenant-model.ts";
import { recordAiUsage } from "../_shared/ai-usage.ts";
import { enrichProspectBrief } from "../_shared/prospect-brief.ts";
import { buildSystemPrompt, resolveGoal } from "../_shared/sales-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TOOL = {
  type: "function" as const,
  function: {
    name: "emit_lead_brief",
    description: "Devuelve la asesoría completa para el asesor sobre este lead.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string", description: "Resumen de 2-3 frases de la relación y conversación con el lead." },
        sentiment: { type: "string", enum: ["positive", "neutral", "negative", "unknown"] },
        intent: { type: "string", enum: ["alta", "media", "baja"] },
        motivators: { type: "array", items: { type: "string" }, description: "Qué le importa al lead (máx 4)." },
        objections: { type: "array", items: { type: "string" }, description: "Objeciones o dudas detectadas (máx 4)." },
        alerts: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            properties: { level: { type: "string", enum: ["danger", "warning", "info"] }, text: { type: "string" } },
            required: ["level", "text"],
          },
          description: "Riesgos: sin respuesta, días sin contacto, tarea vencida, riesgo de pérdida, etc. (máx 4)",
        },
        next_step: {
          type: "object", additionalProperties: false,
          properties: {
            action: { type: "string", enum: ["whatsapp", "call", "meeting", "email", "task", "move_stage", "wait"] },
            title: { type: "string", description: "Qué hacer ahora, en una frase imperativa." },
            reason: { type: "string", description: "Por qué, basado en el contexto." },
            urgency: { type: "string", enum: ["alta", "media", "baja"] },
            when: { type: "string", description: "Cuándo hacerlo, ej. 'Hoy antes de las 13:00'." },
          },
          required: ["action", "title", "reason", "urgency", "when"],
        },
        messages: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            properties: { tone: { type: "string", description: "Ej. Cercano, Directo, Resolver objeción" }, text: { type: "string" } },
            required: ["tone", "text"],
          },
          description: "3 mensajes de WhatsApp listos para enviar, personalizados, máx 450 caracteres cada uno.",
        },
        call_script: {
          type: "object", additionalProperties: false,
          properties: {
            opening: { type: "string" },
            points: { type: "array", items: { type: "string" } },
            objection_handling: {
              type: "array",
              items: { type: "object", additionalProperties: false, properties: { objection: { type: "string" }, answer: { type: "string" } }, required: ["objection", "answer"] },
            },
            close: { type: "string" },
          },
          required: ["opening", "points", "objection_handling", "close"],
        },
        close_probability: {
          type: "object", additionalProperties: false,
          properties: { pct: { type: "number" }, label: { type: "string", enum: ["Alta", "Media", "Baja"] }, reason: { type: "string" } },
          required: ["pct", "label", "reason"],
        },
      },
      required: ["summary", "sentiment", "intent", "motivators", "objections", "alerts", "next_step", "messages", "call_script", "close_probability"],
    },
  },
};

const daysSince = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const maxIso = (...xs: (string | null | undefined)[]) =>
  xs.filter(Boolean).sort().at(-1) ?? null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return json({ error: "No autenticado" }, 401);

  const body = await req.json().catch(() => ({}));
  const contactId = String(body?.contactId ?? "");
  const force = body?.force === true;
  if (!/^[0-9a-f-]{36}$/.test(contactId)) return json({ error: "contactId inválido" }, 400);

  // Contexto (RLS limita a la empresa del usuario)
  const { data: contact } = await sb.from("contacts")
    .select("id, tenant_id, name, last_name, company, position, status, source, tags, email, phone, custom_fields, last_activity_at, created_at, updated_at")
    .eq("id", contactId).maybeSingle();
  if (!contact) return json({ error: "Contacto no encontrado" }, 404);
  const tenantId = contact.tenant_id as string;

  const [dealsRes, actsRes, tasksRes, convRes, attrRes, tenantRes] = await Promise.all([
    sb.from("deals").select("id, name, amount, probability, stage_name, is_won, is_lost, expected_close_date, created_at, updated_at")
      .eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(5),
    sb.from("activities").select("type, description, occurred_at").eq("contact_id", contactId)
      .order("occurred_at", { ascending: false }).limit(15),
    sb.from("tasks").select("title, completed, due_at").eq("contact_id", contactId)
      .order("due_at", { ascending: false, nullsFirst: false }).limit(8),
    sb.from("conversations").select("id").eq("contact_id", contactId),
    sb.from("contact_attribution").select("utm_source, utm_medium, utm_campaign, ad_name, meta_form_name, landing_url, source_kind")
      .eq("contact_id", contactId).eq("touch_type", "first").maybeSingle(),
    sb.from("tenants").select("name, industry").eq("id", tenantId).maybeSingle(),
  ]);
  const deals = dealsRes.data ?? [];
  const acts = actsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const convIds = (convRes.data ?? []).map((c: any) => c.id);
  const [sessionsRes, agentsRes, knowledgeRes] = await Promise.all([
    sb.from("sales_agent_sessions").select("agent_id,profile_data,score,updated_at,missing_fields,handoff_reason,state").eq("tenant_id", tenantId).eq("contact_id", contactId).order("updated_at", { ascending: false }),
    sb.from("sales_agents").select("*").eq("tenant_id", tenantId),
    sb.from("sales_agent_knowledge").select("agent_id,kind,title,content,url").eq("tenant_id", tenantId),
  ]);
  const sessions = sessionsRes.data ?? [];
  const agents = agentsRes.data ?? [];
  const currentAgent = agents.find((a: any) => a.id === sessions[0]?.agent_id);
  let msgs: any[] = [];
  if (convIds.length) {
    const { data } = await sb.from("messages").select("direction, body, sent_at, is_internal_note")
      .in("conversation_id", convIds).order("sent_at", { ascending: false }).limit(30);
    msgs = (data ?? []).reverse();
  }

  const basisAt = maxIso(msgs.at(-1)?.sent_at, acts[0]?.occurred_at, deals[0]?.updated_at, contact.last_activity_at, contact.created_at, contact.updated_at, sessions[0]?.updated_at, currentAgent?.updated_at);

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cached } = await svc.from("lead_assistant_briefs").select("brief, basis_at, generated_at").eq("contact_id", contactId).maybeSingle();
  if (cached && !force && cached.basis_at && basisAt && new Date(cached.basis_at) >= new Date(basisAt)) {
    return json({ brief: enrichProspectBrief(cached.brief, deals, sessions, agents), generated_at: cached.generated_at, cached: true });
  }

  const fullName = [contact.name, contact.last_name].filter(Boolean).join(" ");
  const transcript = msgs.filter((m) => !m.is_internal_note && m.body)
    .map((m) => `[${String(m.sent_at).slice(0, 16).replace("T", " ")}] ${m.direction === "inbound" ? "Lead" : "Asesor/Bot"}: ${String(m.body).slice(0, 500)}`)
    .join("\n") || "(sin mensajes)";
  const notes = msgs.filter((m) => m.is_internal_note).map((m) => `- ${m.body}`).join("\n");
  const lastInbound = [...msgs].reverse().find((m) => m.direction === "inbound");
  const lastOutbound = [...msgs].reverse().find((m) => m.direction === "outbound");

  const agentContext = currentAgent ? buildSystemPrompt(currentAgent, resolveGoal(currentAgent, [], {}),
    (knowledgeRes.data ?? []).filter((k: any) => !k.agent_id || k.agent_id === currentAgent.id), "Asesor", { profile: sessions[0]?.profile_data ?? {}, query: transcript }) : "";
  const context = `
CONFIGURACIÓN Y CONOCIMIENTO APROBADOS DEL NEGOCIO (no imites errores de respuestas antiguas):
${agentContext}
PERFIL CONFIRMADO: ${JSON.stringify(sessions.map((s: any) => s.profile_data))}
Empresa del asesor: ${tenantRes.data?.name ?? ""} (${tenantRes.data?.industry ?? "sin giro"})
Fecha actual: ${new Date().toISOString().slice(0, 16)} UTC (México UTC-6)

LEAD: ${fullName}${contact.company ? ` · ${contact.company}` : ""}${contact.position ? ` · ${contact.position}` : ""}
Ciclo de vida: ${contact.status ?? "-"} · Fuente: ${contact.source ?? "-"} · Etiquetas: ${(contact.tags ?? []).join(", ") || "-"}
Tiene teléfono: ${contact.phone ? "sí" : "no"} · correo: ${contact.email ? "sí" : "no"}
Creado hace ${daysSince(contact.created_at)} días · última actividad hace ${daysSince(contact.last_activity_at) ?? "?"} días
Datos del formulario: ${JSON.stringify(contact.custom_fields ?? {}).slice(0, 600)}
Origen: ${attrRes.data ? JSON.stringify(attrRes.data) : "-"}

OPORTUNIDADES:
${deals.map((d: any) => `- ${d.name} · ${d.stage_name ?? "-"} · $${d.amount ?? 0} MXN · prob ${d.probability ?? 0}% · ${d.is_won ? "GANADA" : d.is_lost ? "PERDIDA" : "abierta"} · cierre esperado ${d.expected_close_date ?? "-"}`).join("\n") || "(ninguna)"}

ACTIVIDADES RECIENTES:
${acts.map((a: any) => `- [${String(a.occurred_at).slice(0, 10)}] ${a.type}: ${String(a.description ?? "").slice(0, 200)}`).join("\n") || "(ninguna)"}

TAREAS:
${tasks.map((t: any) => `- ${t.completed ? "✓" : "○"} ${t.title} (vence ${t.due_at ? String(t.due_at).slice(0, 10) : "-"})`).join("\n") || "(ninguna)"}

NOTAS INTERNAS:
${notes || "(ninguna)"}

Último mensaje del lead: hace ${daysSince(lastInbound?.sent_at) ?? "?"} días · último nuestro: hace ${daysSince(lastOutbound?.sent_at) ?? "?"} días

CONVERSACIÓN WHATSAPP:
${transcript}`;

  const model = await resolveTenantModel(svc, tenantId);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "IA no configurada" }, 500);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.model,
      messages: [
        {
          role: "system",
          content: "Eres el coach de ventas de un asesor comercial en México. Analizas TODO el historial del lead y le dices exactamente qué hacer. " +
            "Español de México, trato de usted o tú según cómo escribe el lead. Sé específico: cita lo que el lead dijo, menciona su nombre y el producto/programa. " +
            "Nunca inventes precios, becas, fechas ni datos que no estén en el contexto; si faltan, sugiere preguntarlos. " +
            "Respeta la configuración y conocimiento aprobados del negocio. No inventes clientes, casos de éxito ni resultados y no conviertas lo que el prospecto contó en un caso de éxito de la empresa. Los mensajes deben sonar humanos y breves; una pregunta como máximo, no obligatoria. Atiende dudas antes de proponer una reunión; no insistas si la rechazó. Si hay más de 24 h sin mensaje del lead, avisa que por WhatsApp solo se puede enviar plantilla aprobada. " +
            "Si hay poco contexto, dilo en el resumen y enfoca el siguiente paso en calificar al lead.",
        },
        { role: "user", content: context },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "emit_lead_brief" } },
    }),
  });
  if (res.status === 429) return json({ error: "Demasiadas solicitudes a la IA, intenta en un momento." }, 429);
  if (res.status === 402) return json({ error: "Sin créditos de IA disponibles." }, 402);
  if (!res.ok) { console.error("gateway", res.status, await res.text()); return json({ error: "La IA no respondió" }, 502); }
  const out = await res.json();
  const args = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let brief: any;
  try { brief = typeof args === "string" ? JSON.parse(args) : args; } catch { brief = null; }
  if (!brief?.next_step) return json({ error: "La IA no devolvió una respuesta válida" }, 502);
  brief.messages = (brief.messages ?? []).slice(0, 3);
  brief.alerts = (brief.alerts ?? []).slice(0, 4);
  brief.close_probability.pct = Math.max(0, Math.min(100, Math.round(Number(brief.close_probability?.pct) || 0)));

  const now = new Date().toISOString();
  const primaryDeal = deals.find((d: any) => !d.is_won && !d.is_lost);
  if (primaryDeal) {
    const { error } = await svc.from("deals").update({ probability: brief.close_probability.pct }).eq("id", primaryDeal.id).eq("tenant_id", tenantId).eq("is_won", false).eq("is_lost", false);
    if (error) return json({ error: "No se pudo guardar la probabilidad" }, 500);
    primaryDeal.probability = brief.close_probability.pct;
  }
  brief = enrichProspectBrief(brief, deals, sessions, agents);
  const { error: saveError } = await svc.from("lead_assistant_briefs").upsert(
    { tenant_id: tenantId, contact_id: contactId, brief, basis_at: basisAt, model: model.model, generated_at: now },
    { onConflict: "contact_id" },
  );
  if (saveError) return json({ error: "No se pudo guardar el resumen" }, 500);
  await recordAiUsage({
    tenantId, userId: u.user.id, surface: "lead_assistant", model: model.model, creditFactor: model.creditFactor,
    inputTokens: out?.usage?.prompt_tokens, outputTokens: out?.usage?.completion_tokens, totalTokens: out?.usage?.total_tokens,
  });
  return json({ brief, generated_at: now, cached: false });
});
