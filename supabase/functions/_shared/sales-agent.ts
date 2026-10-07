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

// ---------- Conocimiento: recupera solo los documentos relevantes a la conversación ----------
const STOP = new Set("de la el los las un una y o que en por para con mi tu su es se lo al del me te le ya si no como cual cuanto hola".split(" "));
function tokens(t: string) {
  return String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w));
}
export function selectKnowledge(knowledge: any[], query: string, topK = 8) {
  if (knowledge.length <= topK) return knowledge;
  const q = new Set(tokens(query));
  const scored = knowledge.map((k) => {
    const title = tokens(k.title || ""); const body = tokens(k.content || "");
    let sc = 0;
    for (const w of title) if (q.has(w)) sc += 3;
    const seen = new Set<string>();
    for (const w of body) if (q.has(w) && !seen.has(w)) { sc += 1; seen.add(w); }
    if (k.kind === "faq") sc += 0.5;
    return { k, sc };
  }).sort((a, b) => b.sc - a.sc);
  return scored.slice(0, topK).map((x) => x.k);
}

export interface ProfilingField { key: string; label: string; question?: string; required?: boolean; condition?: string }

export function profilingFields(agent: any): ProfilingField[] {
  return (Array.isArray(agent.profiling_fields) ? agent.profiling_fields : []).filter((f: any) => f?.key && f?.label);
}

export function missingFields(agent: any, profile: Record<string, any>) {
  return profilingFields(agent).filter((f) => f.required !== false && !f.condition &&
    (profile?.[f.key] === undefined || profile?.[f.key] === null || String(profile[f.key]).trim() === "")).map((f) => f.key);
}

const TRIGGER_TEXT: Record<string, string> = {
  pide_humano: "pide hablar con una persona",
  molestia: "se muestra molesto o frustrado",
  insiste_2: "insiste en un tema después de 2 respuestas tuyas",
  ya_hablo_asesor: "dice que ya habló antes con un asesor",
  fuera_alcance: "pregunta algo fuera de tu alcance (montos exactos, casos específicos, trámites, quejas)",
  quiere_pagar: "quiere pagar o cerrar ya",
};
export const HANDOFF_TRIGGERS = TRIGGER_TEXT;

export interface PromptOpts { query?: string; profile?: Record<string, any>; known?: Record<string, any> }

export function buildSystemPrompt(agent: any, goal: ReturnType<typeof resolveGoal>, knowledge: any[], channel: string, opts: PromptOpts = {}) {
  const kbSel = selectKnowledge(knowledge, opts.query ?? "");
  const kb = kbSel.map((k) => `### ${k.title || k.kind}\n${(k.content || "").slice(0, 3000)}${k.url ? `\nFuente: ${k.url}` : ""}`).join("\n\n");
  const fr = agent.format_rules ?? {};
  const fmt = [
    fr.max_chars ? `máximo ${fr.max_chars} caracteres por mensaje` : "mensajes breves",
    fr.one_question !== false ? "una sola pregunta por mensaje" : "",
    fr.no_lists !== false ? "sin listas, guiones, asteriscos ni markdown" : "",
    fr.max_emojis != null ? `máximo ${fr.max_emojis} emoji(s) por mensaje` : "",
  ].filter(Boolean).join("; ");
  const fields = profilingFields(agent);
  const profile = opts.profile ?? {};
  const known = { ...(opts.known ?? {}), ...profile };
  const knownTxt = Object.entries(known).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`).join("; ");
  const triggers = (Array.isArray(agent.handoff_triggers) ? agent.handoff_triggers : []).map((t: string) => TRIGGER_TEXT[t]).filter(Boolean);
  return [
    `Eres "${agent.name}". ${agent.identity || ""}`,
    `Tono: ${agent.tone || "cercano y profesional"}. Idioma: ${agent.language || "es-MX"}. Canal: ${channel}.`,
    `Formato: ${fmt}.`,
    "Eres un asistente virtual: nunca finjas ser humano; si te lo preguntan, confírmalo.",
    `OBJETIVO ACTUAL: ${goal.goal || "perfilar al lead y agendar el siguiente paso con un asesor"}.`,
    goal.key_message ? `Mensaje clave: ${goal.key_message}` : "",
    agent.out_of_scope ? `NO es tu objetivo: ${agent.out_of_scope}` : "",
    agent.never_do ? `Reglas (qué no decir / temas prohibidos): ${agent.never_do}` : "",
    agent.privacy_url ? `En el primer saludo comparte el aviso de privacidad: ${agent.privacy_url}` : "",
    fields.length ? `\n## Perfilamiento (pide los datos uno por mensaje, en este orden; si ya los tienes, confírmalos en vez de volver a preguntar)\n` +
      fields.map((f, i) => `${i + 1}. ${f.label} [clave: ${f.key}]${f.condition ? ` — solo si: ${f.condition}` : ""}${f.question ? ` — pregunta sugerida: "${f.question}"` : ""}`).join("\n") : "",
    agent.profiling_notes ? `Indicaciones de perfilamiento: ${agent.profiling_notes}` : "",
    knownTxt ? `Datos ya conocidos del lead: ${knownTxt}` : "",
    triggers.length ? `\n## Transfiere al asesor de inmediato si el lead: ${triggers.join("; ")}.` : "",
    agent.objections ? `\n## Objeciones y respuestas aprobadas\n${agent.objections}` : "",
    agent.examples ? `\n## Conversaciones modelo (imita lo correcto, evita lo incorrecto)\n${agent.examples.slice(0, 6000)}` : "",
    "Usa solo la información de la base de conocimiento; si no está, di que el asesor lo confirma. No inventes precios, fechas ni sedes.",
    kb ? `\n## Base de conocimiento\n${kb}` : "",
  ].filter(Boolean).join("\n");
}

/** Instrucción JSON común a WhatsApp y chat web. */
export function jsonInstructions(agent: any) {
  const keys = profilingFields(agent).map((f) => `"${f.key}"`).join(",");
  return `\n\nResponde SOLO en JSON con esta forma: {"reply":"texto para el lead","handoff":true|false,"handoff_reason":"","simple":true|false,` +
    `"profile":{${keys ? `solo claves de: ${keys}` : ""}},"motivator":"","blocker":"","doubts":""}. ` +
    "En profile incluye únicamente los datos que el lead ya dio (no inventes). motivator/blocker: el motivador y freno principal si los detectas. " +
    "simple=true si es una duda básica respondible con la base de conocimiento.";
}

/** Aplica el resultado del turno: guarda perfil, mueve etapa y ejecuta el handoff. */
export async function applyAgentTurn(sb: any, p: {
  agent: any; session: any; parsed: any; tenantId: string; contactId: string; dealId: string | null;
  ownerId: string | null; channelLabel: string; note: (t: string) => Promise<any>;
}) {
  const { agent, session, parsed } = p;
  const prev = (session?.profile_data ?? {}) as Record<string, any>;
  const allowed = new Set(profilingFields(agent).map((f) => f.key));
  const incoming = parsed?.profile && typeof parsed.profile === "object" ? parsed.profile : {};
  const profile: Record<string, any> = { ...prev };
  for (const [k, v] of Object.entries(incoming)) if ((!allowed.size || allowed.has(k)) && v !== null && String(v).trim() !== "") profile[k] = v;
  if (parsed?.motivator) profile._motivador = parsed.motivator;
  if (parsed?.blocker) profile._freno = parsed.blocker;
  if (parsed?.doubts) profile._dudas = parsed.doubts;
  const missing = missingFields(agent, profile);
  const complete = allowed.size > 0 && missing.length === 0;
  const becameComplete = complete && !session?.profile_complete;
  const filled = profilingFields(agent).filter((f) => profile[f.key]).length;
  const score = allowed.size ? Math.round((filled / allowed.size) * 100) : session?.score ?? 0;

  const upd: any = { profile_data: profile, missing_fields: missing, profile_complete: complete, score, lead_replied: true };
  if (!session?.first_reply_at) upd.first_reply_at = new Date().toISOString();
  if (session?.id) await sb.from("sales_agent_sessions").update(upd).eq("id", session.id);

  const summary = () => {
    const lines = profilingFields(agent).map((f) => `${f.label}: ${profile[f.key] ?? "—"}`);
    if (profile._dudas) lines.push(`Dudas planteadas: ${profile._dudas}`);
    if (profile._motivador) lines.push(`Motivador principal: ${profile._motivador}`);
    if (profile._freno) lines.push(`Freno principal: ${profile._freno}`);
    return lines.join("\n");
  };

  const doHandoff = async (reason: string) => {
    if (p.dealId && agent.handoff_stage_id) await sb.from("deals").update({ stage_id: agent.handoff_stage_id }).eq("id", p.dealId);
    let assignee = p.ownerId;
    if (agent.assignment_rule === "least_loaded" || !assignee) {
      const { data: users } = await sb.from("profiles").select("id").eq("tenant_id", p.tenantId).eq("is_active", true);
      const ids = (users ?? []).map((u: any) => u.id);
      if (ids.length) {
        const { data: open } = await sb.from("tasks").select("assignee_id").eq("tenant_id", p.tenantId).eq("completed", false).in("assignee_id", ids);
        const load: Record<string, number> = Object.fromEntries(ids.map((i: string) => [i, 0]));
        for (const t of open ?? []) load[t.assignee_id] = (load[t.assignee_id] ?? 0) + 1;
        if (agent.assignment_rule === "least_loaded" || !assignee) assignee = ids.sort((a: string, b: string) => load[a] - load[b])[0];
        if (assignee && assignee !== p.ownerId) {
          await sb.from("contacts").update({ owner_id: assignee }).eq("id", p.contactId);
          if (p.dealId) await sb.from("deals").update({ owner_id: assignee }).eq("id", p.dealId);
        }
      }
    }
    const sla = Number(agent.sla_minutes ?? 60);
    await sb.from("tasks").insert({ tenant_id: p.tenantId, contact_id: p.contactId, deal_id: p.dealId, assignee_id: assignee ?? null,
      title: `Llamar lead de ${agent.name} (${p.channelLabel}): ${reason}`.slice(0, 200),
      due_at: new Date(Date.now() + sla * 60000).toISOString(), task_kind: "followup" });
    await p.note(`🤝 ${agent.name} transfirió al asesor (${p.channelLabel}). Llamar en máx. ${sla} min.\nMotivo de handoff: ${reason}\n${summary()}`);
    if (session?.id) await sb.from("sales_agent_sessions").update({ state: "escalated", handoff_reason: reason, handoff_at: new Date().toISOString() }).eq("id", session.id);
  };

  if (parsed?.handoff) { await doHandoff(parsed.handoff_reason || "requiere atención humana"); return { handoff: true, profile }; }
  if (becameComplete) {
    if (p.dealId && agent.profiled_stage_id) await sb.from("deals").update({ stage_id: agent.profiled_stage_id }).eq("id", p.dealId);
    await doHandoff("perfilamiento completo");
    return { handoff: true, scheduled: true, profile };
  }
  return { handoff: false, profile };
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

  const lastInbound = [...history].reverse().find((m: any) => m.role === "user")?.content ?? "";
  const { data: ct } = await sb.from("contacts").select("name, email, address").eq("id", ctx.contactId).maybeSingle();
  const system = buildSystemPrompt(agent, goal, kb ?? [], "WhatsApp", {
    query: history.slice(-4).map((m: any) => m.content).join(" "), profile: s.profile_data ?? {},
    known: { nombre_whatsapp: ct?.name, correo: ct?.email, direccion: ct?.address },
  }) + jsonInstructions(agent);
  void lastInbound;

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

  const note = async (text: string) => sb.from("messages").insert({
    tenant_id: ctx.tenantId, conversation_id: ctx.conversationId, channel_id: ctx.channel.id,
    direction: "outbound", body: text, type: "text", is_internal_note: true,
    metadata: { sales_agent_id: agent.id, kind: "agent_note" },
  });

  const turn = await applyAgentTurn(sb, { agent, session: s, parsed, tenantId: ctx.tenantId, contactId: ctx.contactId,
    dealId: deal.id, ownerId: facts.owner_id ?? deal.owner_id ?? null, channelLabel: "WhatsApp", note });
  if (turn.handoff && !turn.scheduled) {
    // Handoff inmediato: avisa al lead con el mensaje configurado (si la autonomía permite enviar).
    if (autonomy !== "sugerencia" && agent.handoff_message) parsed.reply = agent.handoff_message;
    else return { handoff: true };
  }
  const finalReply = String(parsed.reply ?? reply).trim().slice(0, 1500);
  const shouldSendFinal = finalReply && (turn.handoff || autonomy === "autonomo" || (autonomy === "mixto" && parsed.simple !== false));

  if (!shouldSendFinal) {
    if (finalReply) await note(`💡 Sugerencia de ${agent.name}: ${finalReply}`);
    return { suggested: true };
  }

  // 4. Envío dentro de la ventana de 24 h (el lead acaba de escribir → servicio).
  const { data: charge } = await sb.rpc("wa_charge_conversation", {
    _tenant_id: ctx.tenantId, _contact_id: ctx.contactId, _conversation_id: ctx.conversationId,
    _channel_id: ctx.channel.id, _category: "service", _direction: "outbound",
  });
  if (charge?.reason === "insufficient_credits") { await note(`💡 Sin créditos WhatsApp. Sugerencia de ${agent.name}: ${finalReply}`); return { suggested: true }; }

  let wamid: string | null = null; let providerError: string | null = null;
  const isSim = String(ctx.channel.phone_number_id ?? "").startsWith("SIM");
  if (isSim) wamid = `sim.${crypto.randomUUID()}`;
  else if (ctx.channel.access_token && ctx.channel.phone_number_id) {
    const r = await fetch(`${META_API}/${ctx.channel.phone_number_id}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${ctx.channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: ctx.to, type: "text", text: { body: finalReply } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) wamid = j?.messages?.[0]?.id ?? null; else providerError = j?.error?.message ?? `Meta ${r.status}`;
  }
  await sb.from("messages").insert({
    tenant_id: ctx.tenantId, conversation_id: ctx.conversationId, channel_id: ctx.channel.id,
    direction: "outbound", body: finalReply, type: "text",
    metadata: { wamid, provider_error: providerError, bot: true, sales_agent_id: agent.id, sales_agent_name: agent.name },
  });
  await sb.from("conversations").update({ preview: `${agent.name}: ${finalReply}`.slice(0, 200), last_message_at: new Date().toISOString() }).eq("id", ctx.conversationId);
  await sb.from("sales_agent_sessions").update({
    ...(turn.handoff ? {} : {}),
    replies_today: repliesToday + 1, replies_date: today, last_agent_message_at: new Date().toISOString(),
    applied_goal: goal.goal ?? "", applied_rule_id: goal.rule_id, last_channel: "whatsapp",
  }).eq("id", s.id);
  return { sent: !providerError };
}
