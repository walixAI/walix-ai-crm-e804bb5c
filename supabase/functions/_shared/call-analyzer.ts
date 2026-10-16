import { setAiUsageContext } from "./ai-track.ts";
// Análisis IA de una llamada: resumen, perfilamiento, resultado y tipificación sugeridos.
// El perfilamiento solo llena campos vacíos (lo editado por el asesor manda);
// resultado/tipificación quedan como sugerencia hasta que el asesor confirma el seguimiento.

export type AnalyzeResult =
  | { ok: true; summary: string; profileApplied: string[] }
  | { ok: false; status: number; error: string };

export async function analyzeCall(admin: any, callId: string, transcriptOverride?: string): Promise<AnalyzeResult> {
  const { data: call } = await admin.from("calls")
    .select("id, tenant_id, contact_id, deal_id, direction, transcript, notes")
    .eq("id", callId).maybeSingle();
  if (call?.tenant_id) setAiUsageContext({ tenantId: call.tenant_id });
  if (!call) return { ok: false, status: 404, error: "Llamada no encontrada" };

  const transcript = String(transcriptOverride ?? call.transcript ?? "").trim().slice(0, 20000);
  if (transcript.length < 20) return { ok: false, status: 400, error: "La llamada no tiene transcripción suficiente" };
  if (transcriptOverride) await admin.from("calls").update({ transcript }).eq("id", callId);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ok: false, status: 500, error: "IA no configurada" };

  // Oportunidad y pipeline
  let deal: any = null;
  if (call.deal_id) {
    const { data } = await admin.from("deals").select("id, stage_id, pipeline_stages(pipeline_id)").eq("id", call.deal_id).maybeSingle();
    deal = data;
  } else if (call.contact_id) {
    const { data } = await admin.from("deals").select("id, stage_id, pipeline_stages(pipeline_id)")
      .eq("contact_id", call.contact_id).is("won_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    deal = data;
  }
  const pipelineId = deal?.pipeline_stages?.pipeline_id ?? null;

  // Campos de perfilamiento del agente del pipeline
  let fields: { key: string; label: string }[] = [];
  if (pipelineId) {
    const { data: agents } = await admin.from("sales_agents").select("profiling_fields, enabled")
      .eq("tenant_id", call.tenant_id).eq("pipeline_id", pipelineId).order("enabled", { ascending: false }).limit(1);
    fields = (Array.isArray(agents?.[0]?.profiling_fields) ? agents[0].profiling_fields : [])
      .filter((f: any) => f?.key && f?.label).map((f: any) => ({ key: String(f.key), label: String(f.label) }));
  }

  // Resultados de la etapa actual y sus tipificaciones
  let outcomes: any[] = [];
  if (pipelineId) {
    const { data } = await admin.from("activity_outcomes").select("id, label, stage_id")
      .eq("tenant_id", call.tenant_id).eq("pipeline_id", pipelineId).eq("is_active", true);
    outcomes = (data ?? []).filter((o: any) => !o.stage_id || o.stage_id === deal?.stage_id);
  }
  let typs: any[] = [];
  if (outcomes.length) {
    const { data } = await admin.from("outcome_typifications").select("id, label, sentiment, outcome_id")
      .eq("tenant_id", call.tenant_id).eq("is_active", true)
      .in("outcome_id", outcomes.map((o) => o.id));
    typs = data ?? [];
  }

  const schema = {
    type: "object", additionalProperties: false,
    required: ["summary", "next_step", "sentiment", "profile", "outcome_id", "typification_id"],
    properties: {
      summary: { type: "string" },
      next_step: { type: "string" },
      sentiment: { type: "string", enum: ["positivo", "neutral", "negativo"] },
      profile: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "value"],
        properties: { key: { type: "string" }, value: { type: "string" } } } },
      outcome_id: { type: ["string", "null"] },
      typification_id: { type: ["string", "null"] },
    },
  };

  const prompt =
    `Transcripción de la llamada (${call.direction === "inbound" ? "entrante" : "saliente"}):\n${transcript}\n\n` +
    `Campos de perfilamiento (key: etiqueta):\n${fields.map((f) => `- ${f.key}: ${f.label}`).join("\n") || "(ninguno)"}\n\n` +
    `Resultados posibles:\n${outcomes.map((o) => `- ${o.id}: ${o.label}`).join("\n") || "(ninguno)"}\n\n` +
    `Tipificaciones (por resultado):\n${typs.map((t) => `- ${t.id} [resultado ${t.outcome_id}]: ${t.label} (${t.sentiment})`).join("\n") || "(ninguna)"}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: "call_analysis", strict: true, schema } },
      messages: [
        { role: "system", content:
          "Analizas llamadas de ventas en español. summary: 2-3 oraciones con lo que dijo el lead y lo acordado. " +
          "profile: solo datos CONFIRMADOS por el lead, usando las keys dadas; no inventes ni deduzcas precios. " +
          "outcome_id y typification_id: el id exacto de las listas (la tipificación debe pertenecer al resultado) o null si nada aplica claramente. " +
          "Detecta objeciones implícitas (lo está pensando, consulta con familia, dinero, tiempo)." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const msg = res.status === 402 ? "Sin créditos de IA disponibles" : res.status === 429 ? "IA saturada, intenta en un momento" : "No se pudo analizar la llamada";
    return { ok: false, status: res.status === 402 || res.status === 429 || res.status === 403 ? res.status : 502, error: msg };
  }
  const data = await res.json();
  let parsed: any;
  try { parsed = JSON.parse(String(data?.choices?.[0]?.message?.content ?? "")); } catch { parsed = null; }
  if (!parsed?.summary) return { ok: false, status: 502, error: "La IA no devolvió un análisis válido" };

  const outcomeId = outcomes.some((o) => o.id === parsed.outcome_id) ? parsed.outcome_id : null;
  const typ = typs.find((t) => t.id === parsed.typification_id && (!outcomeId || t.outcome_id === outcomeId));
  const validKeys = new Set(fields.map((f) => f.key));
  const profile: Record<string, string> = {};
  for (const p of parsed.profile ?? []) {
    const v = String(p?.value ?? "").trim();
    if (validKeys.has(p?.key) && v) profile[p.key] = v.slice(0, 300);
  }

  // Aplicar perfilamiento solo en campos vacíos
  const applied: string[] = [];
  if (call.contact_id && Object.keys(profile).length) {
    const { data: c } = await admin.from("contacts").select("custom_fields").eq("id", call.contact_id).maybeSingle();
    const cur = (c?.custom_fields ?? {}) as Record<string, any>;
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(profile)) {
      if (cur[k] === undefined || cur[k] === null || String(cur[k]).trim() === "") { patch[k] = v; applied.push(k); }
    }
    if (applied.length) await admin.from("contacts").update({ custom_fields: { ...cur, ...patch } }).eq("id", call.contact_id);
  }

  const suggestions = {
    next_step: parsed.next_step, sentiment: parsed.sentiment, profile, profile_applied: applied,
    outcome_id: outcomeId, outcome_label: outcomes.find((o) => o.id === outcomeId)?.label ?? null,
    typification_id: typ?.id ?? null, typification_label: typ?.label ?? null,
    analyzed_at: new Date().toISOString(),
  };
  await admin.from("calls").update({ ai_summary: parsed.summary, ai_suggestions: suggestions }).eq("id", callId);

  if (call.contact_id) {
    const labels = fields.filter((f) => applied.includes(f.key)).map((f) => `${f.label}: ${profile[f.key]}`);
    await admin.from("activities").insert({
      tenant_id: call.tenant_id, contact_id: call.contact_id, deal_id: deal?.id ?? call.deal_id, type: "note",
      description: `📞 Resumen IA de la llamada: ${parsed.summary}` + (labels.length ? `\nPerfil actualizado — ${labels.join("; ")}` : ""),
      occurred_at: new Date().toISOString(), metadata: { call_id: callId, source: "call_analysis" },
    });
  }
  return { ok: true, summary: parsed.summary, profileApplied: applied };
}
