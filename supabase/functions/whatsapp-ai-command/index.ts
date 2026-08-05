import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3.6-flash";

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
      description: "Crea una tarea/recordatorio para el usuario.",
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
  { type: "function", function: { name: "listar_tareas", description: "Lista tareas pendientes.", parameters: { type: "object", properties: {} } } },
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
1. NUNCA inventes ni adivines un contacto. Antes de registrar algo, llama a buscar_contacto con el nombre tal como lo escribió el usuario (puede venir mal escrito, ej. "Rossi wingd" = "Rosi Guindi").
2. Si el mejor candidato tiene score >= 0.55 y es claramente el único razonable, úsalo y menciona el nombre exacto que usaste ("Anoté en *Rosi Guindi*…").
3. Si hay varios candidatos parecidos o el score es bajo, NO registres: pregunta corto y ofrece opciones numeradas ("¿Te refieres a 1) Rosi Guindi 2) Ambrossi?"). Recuerda el contexto: si el usuario responde "1" o el nombre, continúa con la acción pendiente.
4. Si no existe el contacto, créalo tú con crear_contacto (basta el nombre) y continúa con lo que pidió el usuario en el MISMO turno; no lo dejes esperando.
5. Pide SOLO los datos imprescindibles. Para una oportunidad basta el contacto y una descripción; monto/fecha son opcionales. Nunca pidas listas largas de campos.
6. Si el usuario dice que te equivocaste o pide borrar/corregir lo último, llama a deshacer_ultimo y luego rehaz la acción correcta.
7. Usa el historial de la conversación para entender mensajes cortos ("ya quedó", "corrige", "sí", "el 1").
7b. AGILIDAD: pide varias herramientas a la vez cuando son independientes (buscar dos contactos, resumen + tareas). Si el usuario dicta varias cosas en un mensaje ("anota X y agéndame Y"), resuélvelas TODAS en el mismo turno. Nada de preguntas de cortesía ni relleno.
8. Responde en español mexicano, breve, con formato WhatsApp (*negritas*), máximo ~5 líneas. Confirma siempre QUÉ registraste y EN QUIÉN.
9. Permisos del usuario: ${ctx.level}. ${ctx.level === "read" ? "Solo consultas: no puedes registrar nada; avísale." : ctx.level === "write_light" ? "Puedes registrar notas, tareas y oportunidades, pero no cambiar montos/etapas/ganado-perdido." : "Puedes todo (las acciones fuertes requieren confirmación con código)."}`;
}

async function callGateway(messages: any[]) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto", parallel_tool_calls: true }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
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
      .order("created_at", { ascending: false }).limit(10),
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

  let lastEntity: { type: string; id: string } | null = null;
  let reply = "";

  try {
    for (let step = 0; step < 6; step++) {
      const res = await callGateway(messages);
      const msg = res?.choices?.[0]?.message;
      if (!msg) { reply = "⚠️ No pude procesar tu mensaje."; break; }
      const calls = msg.tool_calls ?? [];
      if (!calls.length) { reply = (msg.content ?? "").trim() || "¿En qué te ayudo?"; break; }
      messages.push(msg);

      for (const call of calls) {
        const name = call.function?.name;
        let a: any = {};
        try { a = JSON.parse(call.function?.arguments ?? "{}"); } catch { /* ignore */ }
        let result: any = {};

        try {
          if (name === "buscar_contacto") {
            const rows = await findContacts(sb, input.tenant_id, ownerFilter, a.query ?? "");
            result = { candidatos: rows.map((c: any) => ({ id: c.id, nombre: c.name, empresa: c.company, telefono: c.phone, estatus: c.status, score: Number(c.score ?? 0).toFixed(2) })) };
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
                else { lastEntity = { type: "activity", id: act.id }; result = { ok: true, contacto: c.name }; }
              }
            }
          } else if (name === "crear_tarea") {
            if (!permAllows(input.permission_level, "write_light")) result = { error: "sin permiso para escribir" };
            else {
              const { data: t, error } = await sb.from("tasks").insert({
                tenant_id: input.tenant_id, assignee_id: input.user_id ?? null, title: a.titulo,
                contact_id: a.contact_id ?? null, due_at: a.due_at ?? null,
              }).select("id").single();
              if (error) result = { error: error.message };
              else { lastEntity = { type: "task", id: t.id }; result = { ok: true, titulo: a.titulo }; }
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
                else { lastEntity = { type: "deal", id: d.id }; result = { ok: true, contacto: c.name, etapa: stage?.name ?? null }; }
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
          } else if (name === "deshacer_ultimo") {
            const { data: last } = await sb.from("whatsapp_command_log").select("id, result_entity_type, result_entity_id")
              .eq("tenant_id", input.tenant_id).eq("from_phone", input.from_phone)
              .not("result_entity_id", "is", null).is("undone_at", null)
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (!last?.result_entity_id) result = { error: "no hay nada reciente que deshacer" };
            else {
              const table = last.result_entity_type === "activity" ? "activities" : last.result_entity_type === "task" ? "tasks" : "deals";
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

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    if (!reply) reply = "Listo.";
  } catch (e) {
    console.error("ai-command error", e);
    reply = "⚠️ Algo salió mal procesando tu solicitud. Intenta de nuevo.";
  }

  await sb.from("whatsapp_command_log").insert({
    tenant_id: input.tenant_id, user_id: input.user_id, channel_id: input.channel_id,
    from_phone: input.from_phone, prompt: input.prompt, intent: "agent",
    action_payload: {}, reply,
    result_entity_type: lastEntity?.type ?? null, result_entity_id: lastEntity?.id ?? null,
    status: "executed", executed_at: new Date().toISOString(),
  });

  return json(reply);
});
