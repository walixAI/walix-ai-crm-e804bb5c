import { createClient } from "npm:@supabase/supabase-js@2";
import { recordAiUsage } from "../_shared/ai-usage.ts";
import { searchGuide, guideIndex } from "../_shared/walix-guide.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3.6-flash";
const APP_URL = "https://s1.walix.app";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
type SB = ReturnType<typeof admin>;

type PermLevel = "read" | "write_light" | "write_strong";

interface CmdInput {
  tenant_id: string;
  user_id: string | null;
  permission_level: PermLevel;
  prompt: string;
  from_phone: string;
  channel_id: string;
}

function permAllows(level: PermLevel, required: PermLevel) {
  const order = { read: 0, write_light: 1, write_strong: 2 } as const;
  return order[level] >= order[required];
}

function token4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

async function isSalesRep(sb: SB, userId: string | null, tenantId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("tenant_id", tenantId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (roles.includes("tenant_owner") || roles.includes("tenant_admin") || roles.includes("sales_manager")) return false;
  return true;
}

// ================= Tools =================

async function findContacts(sb: SB, tenantId: string, ownerId: string | null, query: string) {
  const q = (query ?? "").trim();
  if (!q) return [];
  const { data, error } = await sb.rpc("search_contacts_fuzzy", {
    _tenant_id: tenantId, _q: q, _owner_id: ownerId, _limit: 5,
  });
  if (error) console.error("fuzzy error", error);
  let rows: any[] = data ?? [];
  if (!rows.length) {
    // fallback: token ilike
    const tokens = q.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
    const seen = new Map<string, any>();
    for (const t of tokens.slice(0, 4)) {
      let qq = sb.from("contacts").select("id, name, company, phone, status").eq("tenant_id", tenantId).ilike("name", `%${t}%`).limit(5);
      if (ownerId) qq = qq.eq("owner_id", ownerId);
      const { data: d } = await qq;
      (d ?? []).forEach((c: any) => seen.set(c.id, { ...c, score: 0.4 }));
    }
    rows = [...seen.values()];
  }
  return rows;
}

async function resolveDeals(sb: SB, tenantId: string, ownerId: string | null, query: string) {
  let q = sb.from("deals").select("id, name, amount, stage_name, is_won, is_lost, contact_id").eq("tenant_id", tenantId).limit(5);
  if (ownerId) q = q.eq("owner_id", ownerId);
  if (query) q = q.ilike("name", `%${query}%`);
  const { data } = await q;
  return data ?? [];
}

async function defaultStage(sb: SB, tenantId: string) {
  const { data } = await sb.from("pipeline_stages").select("id, name, position").eq("tenant_id", tenantId)
    .order("position", { ascending: true }).limit(1).maybeSingle();
  return data;
}

// ================= LLM loop =================

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_contacto",
      description: "Busca contactos por nombre aproximado (tolera errores de escritura). Úsalo SIEMPRE antes de registrar algo sobre un contacto. Devuelve candidatos con id y score (0-1).",
      parameters: { type: "object", properties: { query: { type: "string", description: "Nombre tal como lo dijo el usuario" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_contacto",
      description: "Crea un contacto nuevo cuando buscar_contacto no encontró a la persona. Basta el nombre; teléfono/empresa son opcionales.",
      parameters: { type: "object", properties: { nombre: { type: "string" }, telefono: { type: "string" }, empresa: { type: "string" } }, required: ["nombre"] },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_nota",
      description: "Registra una nota/seguimiento en el historial de un contacto. Requiere contact_id obtenido de buscar_contacto.",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, texto: { type: "string" } }, required: ["contact_id", "texto"] },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_tarea",
      description: "Crea una tarea/recordatorio. Si el usuario dice 'le', 'ese contacto' o continúa una conversación sobre un contacto, contact_id es obligatorio y debe provenir de buscar_contacto en este turno.",
      parameters: { type: "object", properties: { titulo: { type: "string" }, contact_id: { type: "string" }, due_at: { type: "string", description: "fecha ISO opcional" } }, required: ["titulo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_oportunidad",
      description: "Crea una oportunidad/lead ligada a un contacto existente. Solo necesita contact_id y nombre; monto y fecha son opcionales, NO los pidas si el usuario no los mencionó.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          nombre: { type: "string", description: "Descripción corta, ej. 'Cotización filtro refrigerador'" },
          monto: { type: "number" },
          tipo: { type: "string", description: "venta o mantenimiento" },
        },
        required: ["contact_id", "nombre"],
      },
    },
  },
  { type: "function", function: { name: "resumen_dia", description: "Tareas de hoy y oportunidades activas.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "estatus_pipeline", description: "Resumen del pipeline por etapa.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "listar_oportunidades", description: "Lista oportunidades, opcionalmente filtradas.", parameters: { type: "object", properties: { query: { type: "string" } } } } },
  {
    type: "function",
    function: {
      name: "mantenimientos_programados",
      description: "Servicios recurrentes programados (mantenimientos, cambios de filtro) por mes. Úsala cuando pregunten por mantenimientos o servicios del mes.",
      parameters: {
        type: "object",
        properties: {
          mes_offset: { type: "number", description: "0 = mes en curso, 1 = próximo mes, -1 = mes pasado. Default 0." },
          tipo: { type: "string", description: "Filtro por nombre del servicio, ej. 'filtro' o 'mantenimiento'." },
        },
      },
    },
  },
  { type: "function", function: { name: "listar_tareas", description: "Lista tareas pendientes.", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: {
      name: "guia_walix",
      description: "MODO TUTOR: devuelve la guía de uso de Walix (qué es cada sección y pasos) cuando el usuario pregunta cómo hacer algo, dónde está algo o qué puede hacer con Walix.",
      parameters: { type: "object", properties: { pregunta: { type: "string" }, listar_todo: { type: "boolean" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "deshacer_ultimo",
      description: "Deshace el último registro que el copiloto creó (nota, tarea u oportunidad) en esta conversación. Úsalo cuando el usuario diga que te equivocaste o pida borrar/corregir lo último.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "accion_sensible",
      description: "Solicita confirmación para acciones fuertes: marcar ganada/perdida, cambiar monto o mover de etapa una oportunidad.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["mark_won", "mark_lost", "update_amount", "move_deal"] },
          deal_name: { type: "string" },
          monto: { type: "number" },
          etapa: { type: "string" },
        },
        required: ["tipo", "deal_name"],
      },
    },
  },
];

function systemPrompt(ctx: { tenantName: string; userName: string; level: PermLevel; today: string }) {
  return `Eres Walix, el copiloto de ventas por WhatsApp de "${ctx.tenantName}". Hablas con ${ctx.userName}. Hoy es ${ctx.today} (America/Mexico_City).

OBJETIVO: hacer la operación ágil. Registra lo que el usuario dicta en lenguaje natural con el mínimo de preguntas.

REGLAS CRÍTICAS:
1. NUNCA inventes ni adivines un contacto. Antes de registrar algo, llama a buscar_contacto con el nombre tal como lo escribió el usuario (puede venir mal escrito, ej. "Rossi wingd" = "Rosi Guindi"). Una coincidencia de apellido solamente NO basta si hay varias personas.
2. Si el mejor candidato tiene score >= 0.55 y es claramente el único razonable, úsalo y menciona el nombre exacto que usaste ("Anoté en *Rosi Guindi*…").
3. Si hay varios candidatos parecidos o el score es bajo, NO registres: pregunta corto y ofrece opciones numeradas ("¿Te refieres a 1) Rosi Guindi 2) Ambrossi?"). Recuerda el contexto: si el usuario responde "1" o el nombre, continúa con la acción pendiente.
4. Si no existe el contacto, créalo tú con crear_contacto (basta el nombre) y continúa con lo que pidió el usuario en el MISMO turno; no lo dejes esperando.
5. Pide SOLO los datos imprescindibles. Para una oportunidad basta el contacto y una descripción; monto/fecha son opcionales. Nunca pidas listas largas de campos.
6. Si el usuario dice que te equivocaste o pide borrar/corregir lo último, llama a deshacer_ultimo y luego rehaz la acción correcta.
7. Usa el historial de la conversación para entender mensajes cortos ("ya quedó", "corrige", "sí", "el 1").
7b. Si el usuario dice "le", "ese contacto" o pide una tarea después de hablar de una oportunidad, conserva EXACTAMENTE el contacto confirmado de la acción anterior; no cambies a otra persona con apellido parecido. Si no puedes identificarlo de forma inequívoca, pregunta antes de escribir.
7c. AGILIDAD: si el usuario dicta varias cosas en un mensaje, resuélvelas TODAS. Las herramientas se ejecutan en orden: primero busca y después escribe.
8. Responde en español mexicano, breve, con formato WhatsApp (*negritas*), máximo ~5 líneas. SOLO puedes decir "registré", "agendé", "guardé" o "listo" cuando el resultado de la herramienta incluya ok:true y verified:true. Si hay error, dilo claramente; nunca simules éxito ni prometas que ya aparecerá.
9. Permisos del usuario: ${ctx.level}. ${ctx.level === "read" ? "Solo consultas: no puedes registrar nada; avísale." : ctx.level === "write_light" ? "Puedes registrar notas, tareas y oportunidades, pero no cambiar montos/etapas/ganado-perdido." : "Puedes todo (las acciones fuertes requieren confirmación con código)."}
10. MODO TUTOR: también enseñas a usar Walix. Si preguntan "cómo...", "dónde...", "para qué sirve", "qué puedes hacer" o se ven perdidos, llama a guia_walix y responde con 2-4 pasos numerados cortos + la ruta del menú. Nunca inventes pantallas ni botones. Cierra ofreciendo hacerlo tú: "¿Lo hago yo?".
${WA_STYLE_GUIDE}`;
}

/** Guía de estilo visual para WhatsApp (mismo lenguaje que las tarjetas del CRM). */
export const WA_STYLE_GUIDE = `
ESTILO VISUAL DE TUS MENSAJES (obligatorio):
• Primera línea = respuesta directa con el dato clave en *negritas*. Nada de saludos ni preámbulos.
• Listas (pipeline, pendientes, contactos): usa una línea por registro con este formato exacto:
  🟢 *Nombre* — Etapa · $Monto
  Usa 🟢 activo/al día, 🔵 en proceso, 🟠 por vencer, 🔴 vencido/en riesgo. Máximo 5 renglones y cierra con "…y N más" si hay más.
• Cifras: siempre con signo y separador de miles ($4,200). Porcentajes con + o − (+47%).
• Bloques de KPI: una sola línea compacta, separada con " · " (ej: "⚡ Cierres hoy *+47%* · 🎯 Run rate *82%*").
• Borradores de mensaje para un cliente: preséntalos así →
  ✨ *Sugerencia de respuesta*
  "…texto del mensaje…"
  y debajo: "Responde *ENVIAR* para mandarlo o dime qué cambio."
• Separa secciones con una línea en blanco; nunca uses tablas, markdown de encabezados (#) ni guiones largos de lista.
• Cierra con UNA acción sugerida corta cuando aplique ("¿Te agendo el seguimiento?").
• Máximo ~8 líneas en total. Si el contenido no cabe, resume y ofrece "¿Te mando el detalle?".`;

// Acumulador de consumo por invocación (no global: habría fugas entre peticiones).
type Usage = { input: number; output: number; total: number; iterations: number };
const newUsage = (): Usage => ({ input: 0, output: 0, total: 0, iterations: 0 });

async function callGateway(messages: any[], usage: Usage) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto", parallel_tool_calls: false }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  usage.iterations += 1;
  usage.input += Number(data?.usage?.prompt_tokens ?? 0);
  usage.output += Number(data?.usage?.completion_tokens ?? 0);
  usage.total += Number(data?.usage?.total_tokens ?? 0);
  return data;
}

// ================= Strong actions =================

async function queueStrongAction(sb: SB, input: CmdInput, intent: string, payload: any, summary: string) {
  const tk = token4();
  await sb.from("whatsapp_command_log").insert({
    tenant_id: input.tenant_id, user_id: input.user_id, channel_id: input.channel_id,
    from_phone: input.from_phone, prompt: input.prompt, intent, action_payload: payload,
    status: "pending_confirmation", confirmation_token: tk,
  });
  return `⚠️ ${summary}\n\nResponde *SÍ ${tk}* para confirmar (o ignora para cancelar).`;
}

async function executeStrong(sb: SB, row: any, ownerId: string | null): Promise<string> {
  const p = row.action_payload ?? {};
  try {
    let q: any;
    if (row.intent === "mark_won" || row.intent === "mark_lost") {
      q = sb.from("deals").update({ is_won: row.intent === "mark_won", is_lost: row.intent === "mark_lost", ...(p.amount ? { amount: p.amount } : {}) }).eq("id", p.deal_id).eq("tenant_id", row.tenant_id);
    } else if (row.intent === "update_amount") {
      q = sb.from("deals").update({ amount: p.amount }).eq("id", p.deal_id).eq("tenant_id", row.tenant_id);
    } else if (row.intent === "move_deal") {
      q = sb.from("deals").update({ stage_id: p.stage_id, stage_name: p.stage_name }).eq("id", p.deal_id).eq("tenant_id", row.tenant_id);
    } else return "Acción no soportada.";
    if (ownerId) q = q.eq("owner_id", ownerId);
    const { error } = await q;
    if (error) throw error;
    await sb.from("whatsapp_command_log").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", row.id);
    return "✅ Confirmado y aplicado.";
  } catch (e) {
    await sb.from("whatsapp_command_log").update({ status: "failed", error_message: String(e) }).eq("id", row.id);
    return "❌ No se pudo aplicar la acción.";
  }
}

// ================= Main =================

function isServiceRoleAuth(auth: string): boolean {
  if (auth.includes(SERVICE_KEY)) return true;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role" && payload?.ref === Deno.env.get("SUPABASE_PROJECT_ID" as string) || payload?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  if (!isServiceRoleAuth(auth)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }

  const input = await req.json() as CmdInput;
  const sb = admin();
  const scopeOwn = await isSalesRep(sb, input.user_id, input.tenant_id);
  const ownerFilter = scopeOwn && input.user_id ? input.user_id : null;

  const json = (reply: string) =>
    new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Confirmation flow
  const m = input.prompt.trim().match(/^s[íi]\s+([a-z0-9]{4})$/i);
  if (m) {
    const tk = m[1].toUpperCase();
    const { data: row } = await sb.from("whatsapp_command_log").select("*")
      .eq("tenant_id", input.tenant_id).eq("confirmation_token", tk).eq("status", "pending_confirmation")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return json("No encontré una acción pendiente con ese código.");
    return json(await executeStrong(sb, row, ownerFilter));
  }

  // Context
  const [{ data: tenant }, { data: profile }, { data: history }] = await Promise.all([
    sb.from("tenants").select("name").eq("id", input.tenant_id).maybeSingle(),
    input.user_id
      ? sb.from("profiles").select("full_name").eq("id", input.user_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    sb.from("whatsapp_command_log").select("prompt, reply, created_at")
      .eq("tenant_id", input.tenant_id).eq("from_phone", input.from_phone)
      .order("created_at", { ascending: false }).limit(6),
  ]);

  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
  const messages: any[] = [{
    role: "system",
    content: systemPrompt({
      tenantName: tenant?.name ?? "tu empresa",
      userName: profile?.full_name ?? "un vendedor",
      level: input.permission_level,
      today,
    }),
  }];
  for (const h of (history ?? []).slice().reverse()) {
    if (h.prompt) messages.push({ role: "user", content: h.prompt });
    if (h.reply) messages.push({ role: "assistant", content: h.reply });
  }
  messages.push({ role: "user", content: input.prompt });

  const usage = newUsage();
  let lastEntity: { type: string; id: string } | null = null;
  const mutationReceipts: Array<{ type: string; id: string; label: string; contactName?: string; contactId?: string; dueAt?: string }> = [];
  const toolErrors: string[] = [];
  let reply = "";

  try {
    for (let step = 0; step < 6; step++) {
      const res = await callGateway(messages, usage);
      const msg = res?.choices?.[0]?.message;
      if (!msg) { reply = "⚠️ No pude procesar tu mensaje."; break; }
      const calls = msg.tool_calls ?? [];
      if (!calls.length) { reply = (msg.content ?? "").trim() || "¿En qué te ayudo?"; break; }
      messages.push(msg);

      const toolMsgs: any[] = [];
      // Las escrituras deben respetar el orden: buscar → resolver → escribir → verificar.
      for (const call of calls) {
        const name = call.function?.name;
        let a: any = {};
        try { a = JSON.parse(call.function?.arguments ?? "{}"); } catch { /* ignore */ }
        let result: any = {};

        try {
          if (name === "buscar_contacto") {
            const rows = await findContacts(sb, input.tenant_id, ownerFilter, a.query ?? "");
            result = { candidatos: rows.map((c: any) => ({ id: c.id, nombre: c.name, empresa: c.company, telefono: c.phone, estatus: c.status, score: Number(c.score ?? 0).toFixed(2) })) };
          } else if (name === "guia_walix") {
            result = a.listar_todo
              ? { ok: true, secciones: guideIndex() }
              : { ok: true, temas: searchGuide(String(a.pregunta ?? "")) };
          } else if (name === "crear_contacto") {
            if (!permAllows(input.permission_level, "write_light")) result = { error: "sin permiso para escribir" };
            else {
              const { data: c, error } = await sb.from("contacts").insert({
                tenant_id: input.tenant_id, owner_id: input.user_id ?? null,
                name: a.nombre, phone: a.telefono ?? null, company: a.empresa ?? null,
                status: "prospecto", source: "WhatsApp Copiloto",
              }).select("id, name").single();
              if (error) result = { error: error.message };
              else {
                const { data: verified } = await sb.from("contacts").select("id, name").eq("id", c.id).eq("tenant_id", input.tenant_id).maybeSingle();
                if (!verified) result = { error: "el contacto no se pudo verificar después de guardarlo" };
                else {
                  lastEntity = { type: "contact", id: c.id };
                  mutationReceipts.push({ type: "contact", id: c.id, label: c.name, contactName: c.name, contactId: c.id });
                  result = { ok: true, verified: true, contact_id: c.id, nombre: c.name, link: `${APP_URL}/contacts/${c.id}` };
                }
              }
            }
          } else if (name === "registrar_nota") {
            if (!permAllows(input.permission_level, "write_light")) result = { error: "sin permiso para escribir" };
            else {
              const { data: c } = await sb.from("contacts").select("id, name").eq("tenant_id", input.tenant_id).eq("id", a.contact_id).maybeSingle();
              if (!c) result = { error: "contact_id inválido, vuelve a buscar el contacto" };
              else {
                const { data: act, error } = await sb.from("activities").insert({
                  tenant_id: input.tenant_id, contact_id: c.id, agent_id: input.user_id ?? null,
                  type: "manual", description: `📝 ${a.texto}`,
                }).select("id").single();
                if (error) result = { error: error.message };
                else {
                  const { data: verified } = await sb.from("activities").select("id, contact_id").eq("id", act.id).eq("tenant_id", input.tenant_id).maybeSingle();
                  if (!verified || verified.contact_id !== c.id) result = { error: "la nota no se pudo verificar después de guardarla" };
                  else {
                    lastEntity = { type: "activity", id: act.id };
                    mutationReceipts.push({ type: "activity", id: act.id, label: a.texto, contactName: c.name, contactId: c.id });
                    result = { ok: true, verified: true, contacto: c.name, contact_id: c.id, link: `${APP_URL}/contacts/${c.id}` };
                  }
                }
              }
            }
          } else if (name === "crear_tarea") {
            if (!permAllows(input.permission_level, "write_light")) result = { error: "sin permiso para escribir" };
            else {
              let taskContact: { id: string; name: string } | null = null;
              if (a.contact_id) {
                const { data: c } = await sb.from("contacts").select("id, name").eq("tenant_id", input.tenant_id).eq("id", a.contact_id).maybeSingle();
                taskContact = c;
                if (!taskContact) result = { error: "contact_id inválido; vuelve a buscar y confirmar el contacto" };
              }
              if (result.error) {
                // No escribir una tarea huérfana cuando el contacto enviado es inválido.
              } else {
              const { data: t, error } = await sb.from("tasks").insert({
                tenant_id: input.tenant_id, assignee_id: input.user_id ?? null, title: a.titulo,
                contact_id: taskContact?.id ?? null, due_at: a.due_at ?? null,
              }).select("id, title, contact_id, assignee_id, due_at").single();
              if (error) result = { error: error.message };
              else {
                const { data: verified } = await sb.from("tasks").select("id, title, contact_id, assignee_id, due_at").eq("id", t.id).eq("tenant_id", input.tenant_id).maybeSingle();
                const validContact = (taskContact?.id ?? null) === (verified?.contact_id ?? null);
                const validAssignee = (input.user_id ?? null) === (verified?.assignee_id ?? null);
                if (!verified || !validContact || !validAssignee) result = { error: "la tarea no se pudo verificar con el contacto y responsable correctos" };
                else {
                  lastEntity = { type: "task", id: t.id };
                  mutationReceipts.push({ type: "task", id: t.id, label: t.title, contactName: taskContact?.name, contactId: taskContact?.id, dueAt: t.due_at ?? undefined });
                  result = { ok: true, verified: true, task_id: t.id, titulo: t.title, contacto: taskContact?.name ?? null, contact_id: taskContact?.id ?? null, responsable_asignado: Boolean(t.assignee_id), due_at: t.due_at, link: taskContact ? `${APP_URL}/contacts/${taskContact.id}` : `${APP_URL}/mi-dia` };
                }
              }
              }
            }
          } else if (name === "crear_oportunidad") {
            if (!permAllows(input.permission_level, "write_light")) result = { error: "sin permiso para escribir" };
            else {
              const { data: c } = await sb.from("contacts").select("id, name").eq("tenant_id", input.tenant_id).eq("id", a.contact_id).maybeSingle();
              if (!c) result = { error: "contact_id inválido, vuelve a buscar el contacto" };
              else {
                const stage = await defaultStage(sb, input.tenant_id);
                const { data: d, error } = await sb.from("deals").insert({
                  tenant_id: input.tenant_id, contact_id: c.id, owner_id: input.user_id ?? null,
                  name: a.nombre, amount: a.monto ?? 0, deal_type: a.tipo ?? "venta",
                  stage_id: stage?.id ?? null, stage_name: stage?.name ?? null, source: "Manual",
                }).select("id").single();
                if (error) result = { error: error.message };
                else {
                  const { data: verified } = await sb.from("deals").select("id, name, contact_id, stage_name").eq("id", d.id).eq("tenant_id", input.tenant_id).maybeSingle();
                  if (!verified || verified.contact_id !== c.id) result = { error: "la oportunidad no se pudo verificar con el contacto correcto" };
                  else {
                    lastEntity = { type: "deal", id: d.id };
                    mutationReceipts.push({ type: "deal", id: d.id, label: verified.name, contactName: c.name, contactId: c.id });
                    result = { ok: true, verified: true, deal_id: d.id, contacto: c.name, contact_id: c.id, etapa: verified.stage_name, link: `${APP_URL}/contacts/${c.id}` };
                  }
                }
              }
            }
          } else if (name === "resumen_dia") {
            const end = new Date(); end.setHours(23, 59, 59, 999);
            let tq = sb.from("tasks").select("title, due_at").eq("tenant_id", input.tenant_id).eq("completed", false).lte("due_at", end.toISOString()).order("due_at").limit(10);
            if (ownerFilter) tq = tq.eq("assignee_id", ownerFilter);
            let dq = sb.from("deals").select("name, amount").eq("tenant_id", input.tenant_id).eq("is_won", false).eq("is_lost", false).order("amount", { ascending: false }).limit(200);
            if (ownerFilter) dq = dq.eq("owner_id", ownerFilter);
            const [{ data: tasks }, { data: deals }] = await Promise.all([tq, dq]);
            result = {
              tareas: (tasks ?? []).map((t: any) => t.title),
              oportunidades_activas: deals?.length ?? 0,
              monto_total: fmtMoney((deals ?? []).reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0)),
              top: (deals ?? []).slice(0, 5).map((d: any) => `${d.name} — ${fmtMoney(Number(d.amount))}`),
            };
          } else if (name === "estatus_pipeline") {
            let q = sb.from("deals").select("amount, probability, stage_name, is_won, is_lost").eq("tenant_id", input.tenant_id).limit(2000);
            if (ownerFilter) q = q.eq("owner_id", ownerFilter);
            const { data } = await q;
            const rows = data ?? [];
            const open = rows.filter((d: any) => !d.is_won && !d.is_lost);
            const byStage: Record<string, { n: number; amt: number }> = {};
            for (const d of open as any[]) {
              const k = d.stage_name ?? "Sin etapa";
              byStage[k] = byStage[k] ?? { n: 0, amt: 0 };
              byStage[k].n++; byStage[k].amt += Number(d.amount ?? 0);
            }
            result = {
              activas: open.length,
              total: fmtMoney(open.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0)),
              ponderado: fmtMoney(open.reduce((s: number, d: any) => s + Number(d.amount ?? 0) * (Number(d.probability ?? 0) / 100), 0)),
              ganadas: rows.filter((d: any) => d.is_won).length,
              perdidas: rows.filter((d: any) => d.is_lost).length,
              por_etapa: Object.entries(byStage).map(([k, v]) => `${k}: ${v.n} — ${fmtMoney(v.amt)}`),
            };
          } else if (name === "listar_oportunidades") {
            const rows = await resolveDeals(sb, input.tenant_id, ownerFilter, a.query ?? "");
            result = { oportunidades: rows.map((d: any) => ({ id: d.id, nombre: d.name, monto: fmtMoney(Number(d.amount)), etapa: d.stage_name })) };
          } else if (name === "listar_tareas") {
            let q = sb.from("tasks").select("title, due_at").eq("tenant_id", input.tenant_id).eq("completed", false).order("due_at").limit(15);
            if (ownerFilter) q = q.eq("assignee_id", ownerFilter);
            const { data } = await q;
            result = { tareas: (data ?? []).map((t: any) => `${t.title}${t.due_at ? ` (${new Date(t.due_at).toLocaleDateString("es-MX")})` : ""}`) };
          } else if (name === "mantenimientos_programados") {
            const off = Number.isFinite(Number(a.mes_offset)) ? Number(a.mes_offset) : 0;
            const base = new Date();
            const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + off, 1));
            const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
            const iso = (d: Date) => d.toISOString().slice(0, 10);
            const { data: subs } = await sb
              .from("recurrence_subscriptions")
              .select("next_due_date, contact_id, contacts(name, phone), recurrence_definitions(name, period_months)")
              .eq("tenant_id", input.tenant_id)
              .gte("next_due_date", iso(from))
              .lt("next_due_date", iso(to))
              .order("next_due_date")
              .limit(300);
            let rows = (subs ?? []) as any[];
            if (a.tipo) {
              const t = String(a.tipo).toLowerCase();
              rows = rows.filter((r) => (r.recurrence_definitions?.name ?? "").toLowerCase().includes(t));
            }
            result = {
              mes: from.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }),
              total: rows.length,
              servicios: rows.slice(0, 60).map((r) => ({
                cliente: r.contacts?.name ?? "Sin nombre",
                servicio: r.recurrence_definitions?.name ?? "Servicio",
                fecha: r.next_due_date,
                link: r.contact_id ? `${APP_URL}/contacts/${r.contact_id}` : null,
              })),
            };
          } else if (name === "deshacer_ultimo") {
            const { data: last } = await sb.from("whatsapp_command_log").select("id, result_entity_type, result_entity_id")
              .eq("tenant_id", input.tenant_id).eq("from_phone", input.from_phone)
              .not("result_entity_id", "is", null).is("undone_at", null)
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (!last?.result_entity_id) result = { error: "no hay nada reciente que deshacer" };
            else {
              const table = last.result_entity_type === "activity" ? "activities" : last.result_entity_type === "task" ? "tasks" : last.result_entity_type === "contact" ? "contacts" : "deals";
              const { error } = await sb.from(table).delete().eq("id", last.result_entity_id).eq("tenant_id", input.tenant_id);
              if (error) result = { error: error.message };
              else {
                await sb.from("whatsapp_command_log").update({ undone_at: new Date().toISOString() }).eq("id", last.id);
                result = { ok: true, eliminado: last.result_entity_type };
              }
            }
          } else if (name === "accion_sensible") {
            if (!permAllows(input.permission_level, "write_strong")) result = { error: "sin permiso para acciones fuertes" };
            else {
              const deals = await resolveDeals(sb, input.tenant_id, ownerFilter, a.deal_name ?? "");
              if (!deals.length) result = { error: `no encontré la oportunidad "${a.deal_name}"` };
              else if (deals.length > 1) result = { ambiguo: deals.map((d: any) => d.name) };
              else {
                const deal: any = deals[0];
                if (a.tipo === "move_deal") {
                  const { data: stage } = await sb.from("pipeline_stages").select("id, name").eq("tenant_id", input.tenant_id).ilike("name", `%${a.etapa ?? ""}%`).limit(1).maybeSingle();
                  if (!stage) result = { error: `no encontré la etapa "${a.etapa}"` };
                  else result = { mensaje: await queueStrongAction(sb, input, "move_deal", { deal_id: deal.id, stage_id: stage.id, stage_name: stage.name }, `Mover "${deal.name}" a "${stage.name}".`) };
                } else if (a.tipo === "update_amount") {
                  result = { mensaje: await queueStrongAction(sb, input, "update_amount", { deal_id: deal.id, amount: a.monto }, `Cambiar monto de "${deal.name}" a ${fmtMoney(a.monto ?? 0)}.`) };
                } else {
                  result = { mensaje: await queueStrongAction(sb, input, a.tipo, { deal_id: deal.id, amount: a.monto }, `Marcar ${a.tipo === "mark_won" ? "GANADA" : "PERDIDA"} "${deal.name}".`) };
                }
              }
            }
          } else {
            result = { error: "herramienta desconocida" };
          }
        } catch (e) {
          console.error("tool error", name, e);
          result = { error: String(e) };
        }

        if (result?.error) toolErrors.push(String(result.error));
        toolMsgs.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      messages.push(...toolMsgs);
    }
    if (!reply) reply = toolErrors.length ? `⚠️ No pude completar la acción: ${toolErrors[0]}` : "No pude completar la solicitud.";
  } catch (e) {
    console.error("ai-command error", e);
    reply = "⚠️ Algo salió mal procesando tu solicitud. Intenta de nuevo.";
  }

  // Una respuesta de éxito se fundamenta en recibos verificados, no en una afirmación del modelo.
  if (mutationReceipts.length) {
    const lines = mutationReceipts.map((r) => {
      const kind = r.type === "task" ? "Tarea" : r.type === "deal" ? "Oportunidad" : r.type === "activity" ? "Nota" : "Contacto";
      return `✅ *${kind}:* ${r.label}${r.contactName && r.type !== "contact" ? `\n👤 *Contacto:* ${r.contactName}` : ""}${r.dueAt ? `\n📅 *Fecha:* ${new Date(r.dueAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })}` : ""}${r.contactId ? `\n🔗 ${APP_URL}/contacts/${r.contactId}` : ""}`;
    });
    reply = lines.join("\n\n");
  } else if (toolErrors.length && /\b(listo|registr[ée]|agend[ée]|guard[ée]|ya qued[oó])\b/i.test(reply)) {
    reply = `⚠️ No pude confirmar el registro: ${toolErrors[0]}`;
  }

  const logPromise = sb.from("whatsapp_command_log").insert({
    tenant_id: input.tenant_id, user_id: input.user_id, channel_id: input.channel_id,
    from_phone: input.from_phone, prompt: input.prompt, intent: "agent",
    action_payload: { receipts: mutationReceipts, errors: toolErrors }, reply,
    result_entity_type: lastEntity?.type ?? null, result_entity_id: lastEntity?.id ?? null,
    status: toolErrors.length && !mutationReceipts.length ? "failed" : "executed", error_message: toolErrors.length ? toolErrors.join(" | ") : null, executed_at: new Date().toISOString(),
  });
  // El historial es parte de la consistencia conversacional: debe persistir antes de responder.
  const { error: logError } = await logPromise;
  if (logError) console.error("command log error", logError);

  // Consumo de IA del Copiloto por WhatsApp (bitácora + créditos del periodo)
  // Atribución: si el teléfono aún no está ligado a una cuenta, se registra su nombre visible.
  const { data: accessRow } = await sb
    .from("whatsapp_user_access")
    .select("user_id, display_name")
    .eq("tenant_id", input.tenant_id)
    .eq("phone_e164", input.from_phone)
    .maybeSingle();

  await recordAiUsage({
    tenantId: input.tenant_id,
    userId: input.user_id ?? accessRow?.user_id ?? null,
    actorLabel: input.user_id ? null : (accessRow?.display_name ?? input.from_phone),
    surface: "whatsapp",
    model: MODEL,
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.total,
    iterations: usage.iterations,
  });

  return json(reply);
});
