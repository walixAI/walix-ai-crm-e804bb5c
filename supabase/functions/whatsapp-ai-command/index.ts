import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

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

async function isSalesRep(sb: ReturnType<typeof admin>, userId: string | null, tenantId: string): Promise<boolean> {
  // Sin usuario CRM vinculado (acceso solo por WhatsApp): no se puede filtrar por dueño.
  if (!userId) return false;
  const { data } = await sb.from("user_roles").select("role")
    .eq("user_id", userId).eq("tenant_id", tenantId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("tenant_owner") || roles.includes("tenant_admin") || roles.includes("sales_manager")) return false;
  return true; // default: scope to own
}

// ----- Tool implementations -----

async function toolDailySummary(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, scopeOwn: boolean) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  let tasksQ = sb.from("tasks").select("title, due_at").eq("tenant_id", tenantId).eq("completed", false)
    .lte("due_at", todayEnd.toISOString()).order("due_at", { ascending: true }).limit(10);
  if (scopeOwn && userId) tasksQ = tasksQ.eq("assignee_id", userId);

  let dealsQ = sb.from("deals").select("name, amount", { count: "exact" }).eq("tenant_id", tenantId)
    .eq("is_won", false).eq("is_lost", false).order("amount", { ascending: false }).limit(1000);
  if (scopeOwn && userId) dealsQ = dealsQ.eq("owner_id", userId);

  const [{ data: tasks }, { data: deals, count: dealsCount }] = await Promise.all([tasksQ, dealsQ]);

  const totalAmt = (deals ?? []).reduce((s, d: any) => s + Number(d.amount ?? 0), 0);
  const lines: string[] = [];
  lines.push(`📋 ${tasks?.length ?? 0} tareas pendientes${tasks?.length ? ":" : "."}`);
  (tasks ?? []).forEach((t: any, i: number) => lines.push(`  ${i + 1}. ${t.title}`));
  lines.push("");
  lines.push(`💼 ${dealsCount ?? deals?.length ?? 0} oportunidades activas (${fmtMoney(totalAmt)})`);
  (deals ?? []).slice(0, 5).forEach((d: any) => lines.push(`  • ${d.name} — ${fmtMoney(Number(d.amount))}`));
  if ((dealsCount ?? 0) > 5) lines.push(`  …y ${(dealsCount ?? 0) - 5} más`);
  return lines.join("\n");
}

async function toolPipelineStatus(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, scopeOwn: boolean) {
  let q = sb.from("deals").select("amount, probability, stage_name, is_won, is_lost").eq("tenant_id", tenantId).limit(2000);
  if (scopeOwn && userId) q = q.eq("owner_id", userId);
  const { data } = await q;
  const rows = data ?? [];
  const open = rows.filter((d: any) => !d.is_won && !d.is_lost);
  if (!open.length) return "No hay oportunidades activas en el pipeline.";
  const total = open.reduce((s, d: any) => s + Number(d.amount ?? 0), 0);
  const weighted = open.reduce((s, d: any) => s + Number(d.amount ?? 0) * (Number(d.probability ?? 0) / 100), 0);
  const byStage = new Map<string, { n: number; amt: number }>();
  for (const d of open as any[]) {
    const k = d.stage_name ?? "Sin etapa";
    const cur = byStage.get(k) ?? { n: 0, amt: 0 };
    cur.n++; cur.amt += Number(d.amount ?? 0);
    byStage.set(k, cur);
  }
  const won = rows.filter((d: any) => d.is_won).length;
  const lost = rows.filter((d: any) => d.is_lost).length;
  const lines = [
    `📊 *Pipeline*`,
    `• ${open.length} oportunidades activas — ${fmtMoney(total)}`,
    `• Ponderado: ${fmtMoney(weighted)}`,
    `• Ganadas: ${won} · Perdidas: ${lost}`,
    "",
    "*Por etapa:*",
    ...[...byStage.entries()].sort((a, b) => b[1].amt - a[1].amt).slice(0, 8)
      .map(([k, v]) => `  • ${k}: ${v.n} — ${fmtMoney(v.amt)}`),
  ];
  return lines.join("\n");
}

async function toolListDeals(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, scopeOwn: boolean, query?: string) {
  let q = sb.from("deals").select("name, amount, stage_name, is_won, is_lost").eq("tenant_id", tenantId).limit(10);
  if (scopeOwn && userId) q = q.eq("owner_id", userId);
  if (query) q = q.ilike("name", `%${query}%`);
  const { data } = await q;
  if (!data?.length) return "No encontré oportunidades.";
  return data.map((d: any) => `• ${d.name} — ${fmtMoney(Number(d.amount))} · ${d.stage_name ?? "—"}${d.is_won ? " ✅" : d.is_lost ? " ❌" : ""}`).join("\n");
}

async function toolListContacts(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, scopeOwn: boolean, query?: string) {
  let q = sb.from("contacts").select("name, company, phone, status").eq("tenant_id", tenantId).limit(10);
  if (scopeOwn && userId) q = q.eq("owner_id", userId);
  if (query) q = q.ilike("name", `%${query}%`);
  const { data } = await q;
  if (!data?.length) return "No encontré contactos.";
  return data.map((c: any) => `• ${c.name}${c.company ? ` (${c.company})` : ""} — ${c.status}`).join("\n");
}

async function toolListTasks(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, scopeOwn: boolean) {
  let q = sb.from("tasks").select("title, due_at, completed").eq("tenant_id", tenantId).eq("completed", false).order("due_at", { ascending: true }).limit(15);
  if (scopeOwn && userId) q = q.eq("assignee_id", userId);
  const { data } = await q;
  if (!data?.length) return "No tienes tareas pendientes. 🎉";
  return data.map((t: any) => `• ${t.title}${t.due_at ? ` — ${new Date(t.due_at).toLocaleDateString("es-MX")}` : ""}`).join("\n");
}

async function toolCreateNote(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, contactQuery: string, text: string) {
  const { data: contact } = await sb.from("contacts").select("id, name").eq("tenant_id", tenantId).ilike("name", `%${contactQuery}%`).limit(1).maybeSingle();
  if (!contact) return `No encontré un contacto que coincida con "${contactQuery}".`;
  await sb.from("activities").insert({
    tenant_id: tenantId, contact_id: contact.id, agent_id: userId ?? null,
    type: "manual", description: `📝 ${text}`,
  });
  return `📝 Nota agregada a ${contact.name}.`;
}

async function toolCreateTask(sb: ReturnType<typeof admin>, tenantId: string, userId: string | null, title: string, contactQuery?: string, dueAt?: string) {
  let contactId: string | null = null;
  if (contactQuery) {
    const { data: c } = await sb.from("contacts").select("id").eq("tenant_id", tenantId).ilike("name", `%${contactQuery}%`).limit(1).maybeSingle();
    contactId = c?.id ?? null;
  }
  await sb.from("tasks").insert({
    tenant_id: tenantId, assignee_id: userId ?? null, title, contact_id: contactId,
    due_at: dueAt ?? null,
  });
  return `✅ Tarea creada: "${title}"${dueAt ? ` para ${new Date(dueAt).toLocaleDateString("es-MX")}` : ""}.`;
}

// ----- Strong actions: stored as pending_confirmation -----

async function queueStrongAction(sb: ReturnType<typeof admin>, input: CmdInput, intent: string, payload: any, summary: string) {
  const tk = token4();
  await sb.from("whatsapp_command_log").insert({
    tenant_id: input.tenant_id, user_id: input.user_id, channel_id: input.channel_id,
    from_phone: input.from_phone, prompt: input.prompt, intent, action_payload: payload,
    status: "pending_confirmation", confirmation_token: tk,
  });
  return `⚠️ ${summary}\n\nResponde *SÍ ${tk}* para confirmar (o ignora para cancelar).`;
}

async function executeStrong(sb: ReturnType<typeof admin>, row: any, scopeOwn: boolean): Promise<string> {
  const p = row.action_payload ?? {};
  const tenantId = row.tenant_id;
  const userId = row.user_id;
  try {
    if (row.intent === "mark_won" || row.intent === "mark_lost") {
      let q = sb.from("deals").update({
        is_won: row.intent === "mark_won",
        is_lost: row.intent === "mark_lost",
        ...(p.amount ? { amount: p.amount } : {}),
      }).eq("id", p.deal_id).eq("tenant_id", tenantId);
      if (scopeOwn && userId) q = q.eq("owner_id", userId);
      const { error } = await q;
      if (error) throw error;
    } else if (row.intent === "update_amount") {
      let q = sb.from("deals").update({ amount: p.amount }).eq("id", p.deal_id).eq("tenant_id", tenantId);
      if (scopeOwn && userId) q = q.eq("owner_id", userId);
      const { error } = await q;
      if (error) throw error;
    } else if (row.intent === "move_deal") {
      let q = sb.from("deals").update({ stage_id: p.stage_id, stage_name: p.stage_name }).eq("id", p.deal_id).eq("tenant_id", tenantId);
      if (scopeOwn && userId) q = q.eq("owner_id", userId);
      const { error } = await q;
      if (error) throw error;
    } else {
      return "Acción no soportada.";
    }
    await sb.from("whatsapp_command_log").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", row.id);
    return "✅ Confirmado y aplicado.";
  } catch (e) {
    await sb.from("whatsapp_command_log").update({ status: "failed", error_message: String(e) }).eq("id", row.id);
    return "❌ No se pudo aplicar la acción.";
  }
}

// ----- LLM intent extraction -----

async function extractIntent(prompt: string, level: PermLevel): Promise<any> {
  const sys = `Eres Walix, asistente de ventas por WhatsApp. Identifica la intención del usuario y devuelve JSON.
Intenciones permitidas según nivel:
- read (siempre): daily_summary, pipeline_status, list_deals, list_contacts, list_tasks
- write_light (${level !== "read" ? "permitido" : "NO permitido"}): create_note, create_task
- write_strong (${level === "write_strong" ? "permitido" : "NO permitido"}): mark_won, mark_lost, update_amount, move_deal
- chat: conversación general / ayuda.

Devuelve EXACTAMENTE JSON {"intent":"...", "args":{...}} sin explicación.
Args por intent:
- daily_summary: {}
- pipeline_status: {}  (usar cuando pregunten por el estatus/resumen/embudo del pipeline u oportunidades en general)
- list_deals: {query?: string}
- list_contacts: {query?: string}
- list_tasks: {}
- create_note: {contact: string, text: string}
- create_task: {title: string, contact?: string, due_at?: ISO date}
- mark_won/mark_lost: {deal_name: string, amount?: number}
- update_amount: {deal_name: string, amount: number}
- move_deal: {deal_name: string, stage_name: string}
- chat: {reply: string}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return { intent: "chat", args: { reply: content } }; }
}

// ----- Main handler -----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Service-role only
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }

  const input = await req.json() as CmdInput;
  const sb = admin();
  const scopeOwn = await isSalesRep(sb, input.user_id, input.tenant_id);

  // Confirmation flow: "SI XXXX" or "SÍ XXXX"
  const m = input.prompt.trim().match(/^s[íi]\s+([a-z0-9]{4})$/i);
  if (m) {
    const tk = m[1].toUpperCase();
    const { data: row } = await sb.from("whatsapp_command_log").select("*")
      .eq("tenant_id", input.tenant_id).eq("confirmation_token", tk).eq("status", "pending_confirmation")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ reply: "No encontré una acción pendiente con ese código." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const reply = await executeStrong(sb, row, scopeOwn);
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let parsed: any;
  try { parsed = await extractIntent(input.prompt, input.permission_level); }
  catch (e) {
    return new Response(JSON.stringify({ reply: "⚠️ Error procesando tu solicitud." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const intent = parsed.intent ?? "chat";
  const args = parsed.args ?? {};

  let reply = "";

  try {
    if (intent === "daily_summary") reply = await toolDailySummary(sb, input.tenant_id, input.user_id, scopeOwn);
    else if (intent === "pipeline_status") reply = await toolPipelineStatus(sb, input.tenant_id, input.user_id, scopeOwn);
    else if (intent === "list_deals") reply = await toolListDeals(sb, input.tenant_id, input.user_id, scopeOwn, args.query);
    else if (intent === "list_contacts") reply = await toolListContacts(sb, input.tenant_id, input.user_id, scopeOwn, args.query);
    else if (intent === "list_tasks") reply = await toolListTasks(sb, input.tenant_id, input.user_id, scopeOwn);
    else if (intent === "create_note") {
      if (!permAllows(input.permission_level, "write_light")) reply = "🚫 No tienes permiso para crear notas.";
      else reply = await toolCreateNote(sb, input.tenant_id, input.user_id, args.contact ?? "", args.text ?? "");
    } else if (intent === "create_task") {
      if (!permAllows(input.permission_level, "write_light")) reply = "🚫 No tienes permiso para crear tareas.";
      else reply = await toolCreateTask(sb, input.tenant_id, input.user_id, args.title ?? "Tarea", args.contact, args.due_at);
    } else if (intent === "mark_won" || intent === "mark_lost" || intent === "update_amount" || intent === "move_deal") {
      if (!permAllows(input.permission_level, "write_strong")) {
        reply = "🚫 No tienes permiso para esta acción.";
      } else {
        // Resolve deal by name
        let q = sb.from("deals").select("id, name, amount, stage_name").eq("tenant_id", input.tenant_id).ilike("name", `%${args.deal_name ?? ""}%`).limit(1);
        if (scopeOwn && input.user_id) q = q.eq("owner_id", input.user_id);
        const { data: deal } = await q.maybeSingle();
        if (!deal) reply = `No encontré una oportunidad que coincida con "${args.deal_name}".`;
        else if (intent === "mark_won") reply = await queueStrongAction(sb, input, "mark_won", { deal_id: deal.id, amount: args.amount }, `Marcar GANADA "${deal.name}"${args.amount ? ` por ${fmtMoney(args.amount)}` : ""}.`);
        else if (intent === "mark_lost") reply = await queueStrongAction(sb, input, "mark_lost", { deal_id: deal.id }, `Marcar PERDIDA "${deal.name}".`);
        else if (intent === "update_amount") reply = await queueStrongAction(sb, input, "update_amount", { deal_id: deal.id, amount: args.amount }, `Cambiar monto de "${deal.name}" a ${fmtMoney(args.amount)}.`);
        else if (intent === "move_deal") {
          const { data: stage } = await sb.from("pipeline_stages").select("id, name").eq("tenant_id", input.tenant_id).ilike("name", `%${args.stage_name}%`).limit(1).maybeSingle();
          if (!stage) reply = `No encontré la etapa "${args.stage_name}".`;
          else reply = await queueStrongAction(sb, input, "move_deal", { deal_id: deal.id, stage_id: stage.id, stage_name: stage.name }, `Mover "${deal.name}" a etapa "${stage.name}".`);
        }
      }
    } else {
      reply = args.reply ?? "Hola, soy Walix. Pídeme cosas como:\n• 'qué tengo hoy'\n• 'mis oportunidades'\n• 'crea tarea llamar a Acme mañana'";
    }

    // Log non-strong actions
    if (!intent.startsWith("mark_") && intent !== "update_amount" && intent !== "move_deal") {
      await sb.from("whatsapp_command_log").insert({
        tenant_id: input.tenant_id, user_id: input.user_id, channel_id: input.channel_id,
        from_phone: input.from_phone, prompt: input.prompt, intent, action_payload: args,
        status: "executed", executed_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("ai-command error", e);
    reply = "⚠️ Algo salió mal procesando tu solicitud.";
  }

  return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});