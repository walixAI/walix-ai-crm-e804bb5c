import type {} from "./generated/ai-gateway/models.d.ts";
import { generateChatCompletion, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.13";
import { recordAiUsage } from "./ai-usage.ts";
import { nonConversationReason, transcriptFingerprint, compactCallCatalog } from "./call-analysis-policy.ts";
// Análisis IA de una llamada: resumen, perfilamiento, resultado y tipificación sugeridos.
// El perfilamiento solo llena campos vacíos (lo editado por el asesor manda);
// resultado/tipificación quedan como sugerencia hasta que el asesor confirma el seguimiento.

export type AnalyzeResult =
  | { ok: true; summary: string; profileApplied: string[]; reused?: boolean; skipped?: boolean }
  | { ok: false; status: number; error: string };

export async function analyzeCall(admin: any, callId: string, transcriptOverride?: string, actorId?: string, manual = false): Promise<AnalyzeResult> {
  const { data: call } = await admin.from("calls")
    .select("id, tenant_id, user_id, contact_id, deal_id, direction, transcript, ai_summary, ai_suggestions")
    .eq("id", callId).maybeSingle();
  if (!call) return { ok: false, status: 404, error: "Llamada no encontrada" };

  const transcript = String(transcriptOverride ?? call.transcript ?? "").trim().slice(0, 20000);
  const fingerprint = await transcriptFingerprint(transcript);
  const oldFingerprint = await transcriptFingerprint(String(call.transcript ?? "").slice(0, 20000));
  if (!manual && call.ai_summary && fingerprint === (call.ai_suggestions?.analysis_fingerprint ?? oldFingerprint)) {
    return { ok: true, summary: call.ai_summary, profileApplied: [], reused: true };
  }
  const skipReason = manual ? null : nonConversationReason(transcript);
  if (!skipReason && transcript.length < 20) return { ok: false, status: 400, error: "La llamada no tiene transcripción suficiente" };
  const { data: claim, error: claimError } = await admin.rpc("claim_call_analysis", {
    p_call_id: callId, p_tenant_id: call.tenant_id,
    p_fingerprint: manual ? `${fingerprint}:${crypto.randomUUID()}` : fingerprint, p_manual: manual,
  });
  if (claimError) return { ok: false, status: 503, error: "No se pudo reservar el análisis" };
  if (claim?.state !== "claimed") {
    if (claim?.state === "skipped") return { ok: true, summary: "", profileApplied: [], skipped: true, reused: true };
    if (claim?.state === "completed") {
      const { data: saved } = await admin.from("calls").select("ai_summary,ai_suggestions").eq("id", callId).eq("tenant_id", call.tenant_id).maybeSingle();
      if (saved?.ai_summary && saved.ai_suggestions?.analysis_fingerprint === fingerprint) return { ok: true, summary: saved.ai_summary, profileApplied: [], reused: true };
    }
    return { ok: false, status: 409, error: claim?.state === "processing" ? "La llamada ya se está analizando" : "El intento anterior no se repetirá automáticamente; solicita volver a analizar" };
  }
  const finish = async (status: string) => {
    const { error } = await admin.from("call_analysis_runs").update({ status, finished_at: new Date().toISOString() })
      .eq("id", claim.id).eq("tenant_id", call.tenant_id);
    if (error) throw error;
  };
  try {
  if (transcriptOverride !== undefined) {
    const { error } = await admin.from("calls").update({ transcript }).eq("id", callId).eq("tenant_id", call.tenant_id);
    if (error) throw error;
  }
  if (skipReason) {
    const { error } = await admin.from("calls").update({ ai_summary: null, ai_suggestions: {
      transcription_status: "completed", analysis_status: "skipped", analysis_skip_reason: skipReason, analysis_fingerprint: fingerprint } })
      .eq("id", callId).eq("tenant_id", call.tenant_id);
    if (error) throw error;
    await finish("skipped");
    return { ok: true, summary: "", profileApplied: [], skipped: true };
  }

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
    const { data } = await admin.from("activity_outcomes").select("id, label, stage_id, is_connection_result")
      .eq("tenant_id", call.tenant_id).eq("pipeline_id", pipelineId).eq("is_active", true);
    // Los hechos de conexión (sin respuesta, ocupado, buzón, falló) ya los registró el proveedor.
    outcomes = (data ?? []).filter((o: any) => (!o.stage_id || o.stage_id === deal?.stage_id) && !o.is_connection_result);
  }
  let typs: any[] = [];
  if (outcomes.length) {
    const { data } = await admin.from("outcome_typifications").select("id, label, sentiment, outcome_id")
      .eq("tenant_id", call.tenant_id).eq("is_active", true)
      .or(`outcome_id.in.(${outcomes.map((o) => o.id).join(",")}),outcome_id.is.null`);
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

  const compact = compactCallCatalog(fields, outcomes, typs);
  const prompt = `Catálogo [alias, etiqueta]; tipificaciones [alias, resultado o null=global, etiqueta, sentimiento]:\n${compact.catalog}\n\n` +
    `Transcripción ${call.direction === "inbound" ? "entrante" : "saliente"}:\n${transcript}`;

  const data = await generateChatCompletion({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: "call_analysis", strict: true, schema } },
      messages: [
        { role: "system", content:
          "Analizas llamadas de ventas en español. summary: 2-3 oraciones con lo que dijo el lead y lo acordado. " +
          "profile: solo datos CONFIRMADOS por el lead, usando los alias f de campos; no inventes ni deduzcas precios. " +
          "outcome_id y typification_id: alias o y t del catálogo (tipificación del resultado o global), o null si nada aplica claramente. " +
          "Detecta objeciones implícitas (lo está pensando, consulta con familia, dinero, tiempo)." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 1500,
  }, { maxRetries: 0 }).catch((error: unknown) => {
    if (!(error instanceof GatewayError)) throw error;
    console.error("[call-analysis] gateway", error.code, error.httpStatus);
    return error;
  });
  if (data instanceof GatewayError) {
    await finish("unknown");
    const status = data.httpStatus;
    return { ok: false, status: status === 402 || status === 429 || status === 403 ? status : 502,
      error: status === 402 ? "Sin créditos de IA disponibles" : status === 429 ? "IA saturada, intenta en un momento" : "No se pudo analizar la llamada" };
  }
  // Explicitly awaited here: provider callbacks use legacy serve(), not Deno.serve().
  // A successful model response counts even if parsing or persistence later fails.
  await recordAiUsage({ tenantId: call.tenant_id, userId: actorId ?? call.user_id,
    surface: "call_analyzer", model: "openai/gpt-6-astra", charge: false,
    inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens });
  let parsed: any;
  try { parsed = JSON.parse(String(data?.choices?.[0]?.message?.content ?? "")); } catch { parsed = null; }
  if (!parsed?.summary) { await finish("failed"); return { ok: false, status: 502, error: "La IA no devolvió un análisis válido" }; }

  const outcomeId = compact.outcomeMap.get(parsed.outcome_id) ?? null;
  const typId = compact.typMap.get(parsed.typification_id);
  const typ = typs.find((t) => t.id === typId && (t.outcome_id === null || (outcomeId && t.outcome_id === outcomeId)));
  const validKeys = new Set(fields.map((f) => f.key));
  const profile: Record<string, string> = {};
  for (const p of parsed.profile ?? []) {
    const v = String(p?.value ?? "").trim();
    const key = compact.fieldMap.get(p?.key);
    if (key && validKeys.has(key) && v) profile[key] = v.slice(0, 300);
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
    ...call.ai_suggestions, transcription_status: "completed", analysis_status: "completed", analysis_skip_reason: null, analysis_fingerprint: fingerprint,
    next_step: parsed.next_step, sentiment: parsed.sentiment, profile, profile_applied: applied,
    outcome_id: outcomeId, outcome_label: outcomes.find((o) => o.id === outcomeId)?.label ?? null,
    typification_id: typ?.id ?? null, typification_label: typ?.label ?? null,
    analyzed_at: new Date().toISOString(),
  };
  const { error: saveError } = await admin.from("calls").update({ ai_summary: parsed.summary, ai_suggestions: suggestions }).eq("id", callId).eq("tenant_id", call.tenant_id);
  if (saveError) throw saveError;

  if (call.contact_id) {
    const labels = fields.filter((f) => applied.includes(f.key)).map((f) => `${f.label}: ${profile[f.key]}`);
    await admin.from("activities").insert({
      tenant_id: call.tenant_id, contact_id: call.contact_id, deal_id: deal?.id ?? call.deal_id, type: "note",
      description: `📞 Resumen IA de la llamada: ${parsed.summary}` + (labels.length ? `\nPerfil actualizado — ${labels.join("; ")}` : ""),
      occurred_at: new Date().toISOString(), metadata: { call_id: callId, source: "call_analysis" },
    });
  }
  await finish("completed");
  return { ok: true, summary: parsed.summary, profileApplied: applied };
  } catch (error) {
    await finish("unknown");
    throw error;
  }
}
