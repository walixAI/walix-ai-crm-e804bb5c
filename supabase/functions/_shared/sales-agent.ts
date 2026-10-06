// Núcleo del Agente de ventas por Pipeline: resolución de responsable, objetivo aplicable
// y construcción del contexto (identidad + conocimiento + objetivo) compartido por todos los canales.

export interface Condition { field: string; op?: string; value: any }

export interface LeadFacts {
  source?: string | null;
  tags?: string[];
  owner_id?: string | null;
  stage_id?: string | null;
  address?: string | null;
  score?: number;
  month?: number; // 1-12, para temporadas
}

function norm(v: any) { return String(v ?? "").trim().toLowerCase(); }

export function matchCondition(c: Condition, f: LeadFacts): boolean {
  const vals: any[] = Array.isArray(c.value) ? c.value : [c.value];
  switch (c.field) {
    case "source": return vals.some((v) => norm(v) === norm(f.source));
    case "tag": return vals.some((v) => (f.tags ?? []).map(norm).includes(norm(v)));
    case "owner_id": return vals.includes(f.owner_id);
    case "stage_id": return vals.includes(f.stage_id);
    case "city": return vals.some((v) => norm(f.address).includes(norm(v)));
    case "month": return vals.map(Number).includes(f.month ?? new Date().getMonth() + 1);
    case "score_min": return (f.score ?? 0) >= Number(vals[0] ?? 0);
    default: return false;
  }
}

export function matchAll(conds: Condition[] | null | undefined, f: LeadFacts) {
  const list = Array.isArray(conds) ? conds : [];
  return list.every((c) => matchCondition(c, f));
}

/** Elige UN responsable: más específico → prioridad → por defecto → null (asesor manual). */
export function resolveAgent<T extends { enabled: boolean; is_default: boolean; priority: number; assignment_conditions: any }>(
  agents: T[], f: LeadFacts,
): T | null {
  const active = agents.filter((a) => a.enabled);
  const specific = active
    .filter((a) => !a.is_default && Array.isArray(a.assignment_conditions) && a.assignment_conditions.length > 0)
    .filter((a) => matchAll(a.assignment_conditions, f))
    .sort((a, b) => (b.assignment_conditions.length - a.assignment_conditions.length) || (b.priority - a.priority));
  if (specific[0]) return specific[0];
  return active.find((a) => a.is_default) ?? null;
}

export function resolveGoal(agent: any, rules: any[], f: LeadFacts) {
  const rule = rules
    .filter((r) => r.active && matchAll(r.conditions, f))
    .sort((a, b) => b.priority - a.priority)[0];
  if (rule) {
    return { rule_id: rule.id, rule_name: rule.name, goal: rule.goal, key_message: rule.key_message,
      autonomy: rule.autonomy || agent.autonomy, allow_close: rule.allow_close };
  }
  return { rule_id: null, rule_name: null, goal: agent.default_goal, key_message: agent.default_key_message,
    autonomy: agent.autonomy, allow_close: agent.default_allow_close };
}

export async function loadLeadFacts(sb: any, contactId: string, pipelineId: string): Promise<LeadFacts> {
  const { data: c } = await sb.from("contacts").select("source, tags, owner_id, address").eq("id", contactId).maybeSingle();
  const { data: d } = await sb.from("deals").select("stage_id").eq("contact_id", contactId)
    .eq("pipeline_id", pipelineId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { source: c?.source, tags: c?.tags ?? [], owner_id: c?.owner_id, address: c?.address,
    stage_id: d?.stage_id ?? null, month: new Date().getMonth() + 1 };
}

export function buildSystemPrompt(agent: any, goal: ReturnType<typeof resolveGoal>, knowledge: any[], channel: string) {
  const kb = knowledge.slice(0, 40).map((k) => `### ${k.title || k.kind}\n${(k.content || "").slice(0, 2500)}${k.url ? `\nFuente: ${k.url}` : ""}`).join("\n\n");
  return [
    `Eres "${agent.name}", agente de ventas. ${agent.identity || ""}`,
    `Tono: ${agent.tone || "cercano y profesional"}. Idioma: ${agent.language || "es-MX"}.`,
    `Canal: ${channel}. Responde breve (máx. 3-4 oraciones), una pregunta a la vez.`,
    `OBJETIVO ACTUAL: ${goal.goal || "calificar al lead y agendar el siguiente paso"}.`,
    goal.key_message ? `Mensaje clave: ${goal.key_message}` : "",
    agent.never_do ? `NUNCA: ${agent.never_do}` : "",
    "Perfila al lead (necesidad, presupuesto, tiempo, decisor). Si piden hablar con una persona, hay una queja o no sabes la respuesta, indica que lo canalizas con un asesor.",
    "Usa solo la información de la base de conocimiento; no inventes precios ni fechas.",
    kb ? `\n## Base de conocimiento\n${kb}` : "",
  ].filter(Boolean).join("\n");
}

// ---------- Respuesta en WhatsApp (se llama desde el webhook tras guardar el mensaje entrante) ----------
const META_API = "https://graph.facebook.com/v20.0";

interface InboundCtx {
  tenantId: string; contactId: string; conversationId: string;
  channel: { id: string; access_token: string | null; phone_number_id: string | null };
  to: string;
}

export async function handleInboundWithAgent(sb: any, ctx: InboundCtx) {
  // 1. Pipeline del lead: oportunidad abierta más reciente.
  const { data: deal } = await sb.from("deals").select("id, pipeline_id, owner_id")
    .eq("contact_id", ctx.contactId).eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!deal?.pipeline_id) return { skipped: "sin_oportunidad" };

  const { data: agents } = await sb.from("sales_agents").select("*")
    .eq("tenant_id", ctx.tenantId).eq("pipeline_id", deal.pipeline_id);
  const facts = await loadLeadFacts(sb, ctx.contactId, deal.pipeline_id);
  const agent = resolveAgent(agents ?? [], facts);
  if (!agent) return { skipped: "sin_agente" }; // atención manual del asesor
  if (!(agent.channels?.whatsapp ?? true)) return { skipped: "canal_apagado" };

  // 2. Sesión del lead con este agente.
  const today = new Date().toISOString().slice(0, 10);
  let { data: s } = await sb.from("sales_agent_sessions").select("*")
    .eq("contact_id", ctx.contactId).eq("agent_id", agent.id).maybeSingle();
  if (!s) {
    const ins = await sb.from("sales_agent_sessions").insert({
      tenant_id: ctx.tenantId, contact_id: ctx.contactId, agent_id: agent.id, pipeline_id: deal.pipeline_id,
      state: "agent", last_channel: "whatsapp",
    }).select("*").single();
    s = ins.data;
  }
  if (!s || s.state !== "agent") return { skipped: "asesor_atiende" };
  if (s.paused_until && new Date(s.paused_until) > new Date()) return { skipped: "pausado" };
  const repliesToday = s.replies_date === today ? s.replies_today : 0;
  const cap = Number(agent.caps?.replies_per_lead_day ?? 20);
  if (repliesToday >= cap) return { skipped: "tope_diario" };

  const { data: rules } = await sb.from("sales_agent_goal_rules").select("*").eq("agent_id", agent.id);
  const goal = resolveGoal(agent, rules ?? [], facts);
  const { data: kb } = await sb.from("sales_agent_knowledge").select("kind,title,content,url")
    .eq("tenant_id", ctx.tenantId).or(`agent_id.is.null,agent_id.eq.${agent.id}`);

  // 3. Historial.
  const { data: hist } = await sb.from("messages").select("direction, body, is_internal_note")
    .eq("conversation_id", ctx.conversationId).order("sent_at", { ascending: false }).limit(20);
  const history = (hist ?? []).reverse().filter((m: any) => !m.is_internal_note && m.body)
    .map((m: any) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.body }));

  const system = buildSystemPrompt(agent, goal, kb ?? [], "WhatsApp") +
    `\n\nResponde SOLO en JSON: {"reply":"texto para el lead","handoff":true|false,"handoff_reason":"","simple":true|false}.` +
    ` handoff=true si pide humano, hay queja, quiere pagar/inscribirse ya, o no sabes responder. simple=true si es una duda básica respondible con la base de conocimiento.`;

  const { resolveTenantModel } = await import("./tenant-model.ts");
  const { recordAiUsage } = await import("./ai-usage.ts");
  const tm = await resolveTenantModel(sb, ctx.tenantId);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: tm.model, messages: [{ role: "system", content: system }, ...history],
      response_format: { type: "json_object" } }),
  });
  if (!res.ok) { console.error("sales-agent ai", res.status, await res.text()); return { skipped: "ia_error" }; }
  const out = await res.json();
  await recordAiUsage({ tenantId: ctx.tenantId, actorLabel: agent.name, surface: "sales_agent", model: tm.model,
    inputTokens: out.usage?.prompt_tokens, outputTokens: out.usage?.completion_tokens, creditFactor: tm.creditFactor });

  let parsed: any = {};
  const raw = out.choices?.[0]?.message?.content ?? "";
  try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { parsed = { reply: raw }; }
  const reply = String(parsed.reply ?? "").trim().slice(0, 1500);

  const autonomy = goal.autonomy || agent.autonomy;
  const shouldSend = reply && !parsed.handoff &&
    (autonomy === "autonomo" || (autonomy === "mixto" && parsed.simple !== false));

  const note = async (text: string) => sb.from("messages").insert({
    tenant_id: ctx.tenantId, conversation_id: ctx.conversationId, channel_id: ctx.channel.id,
    direction: "outbound", body: text, type: "text", is_internal_note: true,
    metadata: { sales_agent_id: agent.id, kind: "agent_note" },
  });

  if (parsed.handoff) {
    await sb.from("sales_agent_sessions").update({ state: "escalated", last_channel: "whatsapp" }).eq("id", s.id);
    await note(`🤝 ${agent.name} canalizó al asesor: ${parsed.handoff_reason || "requiere atención humana"}${reply ? `\nSugerencia: ${reply}` : ""}`);
    await sb.from("tasks").insert({ tenant_id: ctx.tenantId, contact_id: ctx.contactId, deal_id: deal.id,
      assignee_id: facts.owner_id ?? deal.owner_id ?? null, title: `Atender lead canalizado por ${agent.name}`,
      due_at: new Date().toISOString(), task_kind: "followup" });
    return { handoff: true };
  }

  if (!shouldSend) {
    if (reply) await note(`💡 Sugerencia de ${agent.name}: ${reply}`);
    return { suggested: true };
  }

  // 4. Envío dentro de la ventana de 24 h (el lead acaba de escribir → servicio).
  const { data: charge } = await sb.rpc("wa_charge_conversation", {
    _tenant_id: ctx.tenantId, _contact_id: ctx.contactId, _conversation_id: ctx.conversationId,
    _channel_id: ctx.channel.id, _category: "service", _direction: "outbound",
  });
  if (charge?.reason === "insufficient_credits") { await note(`💡 Sin créditos WhatsApp. Sugerencia de ${agent.name}: ${reply}`); return { suggested: true }; }

  let wamid: string | null = null; let providerError: string | null = null;
  const isSim = String(ctx.channel.phone_number_id ?? "").startsWith("SIM");
  if (isSim) wamid = `sim.${crypto.randomUUID()}`;
  else if (ctx.channel.access_token && ctx.channel.phone_number_id) {
    const r = await fetch(`${META_API}/${ctx.channel.phone_number_id}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${ctx.channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: ctx.to, type: "text", text: { body: reply } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) wamid = j?.messages?.[0]?.id ?? null; else providerError = j?.error?.message ?? `Meta ${r.status}`;
  }
  await sb.from("messages").insert({
    tenant_id: ctx.tenantId, conversation_id: ctx.conversationId, channel_id: ctx.channel.id,
    direction: "outbound", body: reply, type: "text",
    metadata: { wamid, provider_error: providerError, bot: true, sales_agent_id: agent.id, sales_agent_name: agent.name },
  });
  await sb.from("conversations").update({ preview: `${agent.name}: ${reply}`.slice(0, 200), last_message_at: new Date().toISOString() }).eq("id", ctx.conversationId);
  await sb.from("sales_agent_sessions").update({
    replies_today: repliesToday + 1, replies_date: today, last_agent_message_at: new Date().toISOString(),
    applied_goal: goal.goal ?? "", applied_rule_id: goal.rule_id, last_channel: "whatsapp",
  }).eq("id", s.id);
  return { sent: !providerError };
}
