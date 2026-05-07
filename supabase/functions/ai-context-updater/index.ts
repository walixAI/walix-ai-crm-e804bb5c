// Edge Function: ai-context-updater
// Trigger: Database Webhook on INSERT into public.ai_memory_events
// Purpose: Recompute ai_entity_context using LLM and emit proactive suggestions when urgency is high.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface MemoryEvent {
  id: string;
  tenant_id: string;
  entity_type: "contact" | "deal" | "conversation" | "team";
  entity_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

interface UpdatedContext {
  context_summary: string;
  key_facts: string[];
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  urgency_score: number;
  proactive_suggestion?: {
    text: string;
    action_type: "send_whatsapp" | "move_deal" | "create_task" | "schedule_followup";
    action_payload?: Record<string, unknown>;
    priority?: number;
  } | null;
}

async function callLLM(prompt: string, system: string): Promise<UpdatedContext> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  const cleaned = typeof raw === "string" ? raw.replace(/^```json\s*|\s*```$/g, "") : "{}";
  const parsed = JSON.parse(cleaned);
  return {
    context_summary: String(parsed.context_summary ?? ""),
    key_facts: Array.isArray(parsed.key_facts) ? parsed.key_facts.slice(0, 10).map(String) : [],
    sentiment: ["positive", "neutral", "negative", "unknown"].includes(parsed.sentiment)
      ? parsed.sentiment
      : "unknown",
    urgency_score: Math.max(0, Math.min(100, Number(parsed.urgency_score) || 0)),
    proactive_suggestion: parsed.proactive_suggestion ?? null,
  };
}

async function generateProactiveSuggestion(
  event: MemoryEvent,
  updated: UpdatedContext
): Promise<void> {
  const sug = updated.proactive_suggestion;

  // Resolver target_user_id: dueño del contacto/deal si existe; si no, actor del evento.
  let targetUserId: string | null = event.actor_id;
  try {
    if (event.entity_type === "contact") {
      const { data } = await admin
        .from("contacts")
        .select("owner_id")
        .eq("id", event.entity_id)
        .maybeSingle();
      if (data?.owner_id) targetUserId = data.owner_id;
    } else if (event.entity_type === "deal") {
      const { data } = await admin
        .from("deals")
        .select("owner_id")
        .eq("id", event.entity_id)
        .maybeSingle();
      if (data?.owner_id) targetUserId = data.owner_id;
    }
  } catch (_) {
    // best-effort
  }

  const text =
    sug?.text ??
    `Esta ${event.entity_type === "deal" ? "oportunidad" : "conversación"} requiere atención (urgencia ${updated.urgency_score}/100).`;
  const actionType = sug?.action_type ?? "create_task";
  const actionPayload = sug?.action_payload ?? {};
  const priority = Math.max(1, Math.min(10, Number(sug?.priority) || Math.round(updated.urgency_score / 10)));

  await admin.from("ai_proactive_suggestions").insert({
    tenant_id: event.tenant_id,
    target_user_id: targetUserId,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    suggestion_text: text,
    action_type: actionType,
    action_payload: actionPayload,
    priority,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Supabase DB webhook payload: { type, table, record, old_record, schema }
    const record: MemoryEvent | undefined = body?.record ?? body;
    if (!record?.entity_id || !record?.tenant_id || !record?.entity_type) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Últimos 20 eventos de la entidad
    const { data: recentEvents } = await admin
      .from("ai_memory_events")
      .select("event_type,event_data,created_at,actor_id")
      .eq("tenant_id", record.tenant_id)
      .eq("entity_type", record.entity_type)
      .eq("entity_id", record.entity_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // 2. Contexto actual
    const { data: currentContext } = await admin
      .from("ai_entity_context")
      .select("*")
      .eq("tenant_id", record.tenant_id)
      .eq("entity_type", record.entity_type)
      .eq("entity_id", record.entity_id)
      .maybeSingle();

    // 3. LLM
    const system = [
      "Eres el motor de memoria de un CRM para PyMEs mexicanas.",
      "Actualiza el resumen de contexto de la entidad dado el nuevo evento y el historial.",
      "Responde SOLO con JSON válido y este formato exacto:",
      "{",
      '  "context_summary": string (máx 600 chars, en español, factual),',
      '  "key_facts": string[] (5-8 hechos clave breves),',
      '  "sentiment": "positive" | "neutral" | "negative" | "unknown",',
      '  "urgency_score": number (0-100),',
      '  "proactive_suggestion": null | { "text": string, "action_type": "send_whatsapp"|"move_deal"|"create_task"|"schedule_followup", "action_payload": object, "priority": number 1-10 }',
      "}",
      "Solo incluye proactive_suggestion si urgency_score > 70.",
    ].join("\n");

    const userPrompt = [
      `Entidad: ${record.entity_type} (${record.entity_id})`,
      `Contexto actual: ${currentContext?.context_summary || "Sin contexto previo"}`,
      `Hechos conocidos: ${JSON.stringify(currentContext?.key_facts ?? [])}`,
      `Sentimiento previo: ${currentContext?.sentiment ?? "unknown"} | Urgencia previa: ${currentContext?.urgency_score ?? 0}`,
      `Nuevo evento: ${record.event_type} — ${JSON.stringify(record.event_data ?? {})}`,
      `Historial reciente (más reciente primero): ${JSON.stringify(recentEvents ?? [])}`,
      "Actualiza el contexto.",
    ].join("\n");

    let updated: UpdatedContext;
    try {
      updated = await callLLM(userPrompt, system);
    } catch (e) {
      console.error("[ai-context-updater] LLM failed", e);
      // Fallback mínimo: solo refrescar last_interaction
      await admin.from("ai_entity_context").upsert(
        {
          tenant_id: record.tenant_id,
          entity_type: record.entity_type,
          entity_id: record.entity_id,
          last_interaction: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,entity_type,entity_id" }
      );
      return new Response(JSON.stringify({ ok: true, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Guardar contexto
    await admin.from("ai_entity_context").upsert(
      {
        tenant_id: record.tenant_id,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        context_summary: updated.context_summary,
        key_facts: updated.key_facts,
        sentiment: updated.sentiment,
        urgency_score: updated.urgency_score,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,entity_type,entity_id" }
    );

    // 5. Sugerencia proactiva
    if (updated.urgency_score > 70) {
      try {
        await generateProactiveSuggestion(record, updated);
      } catch (e) {
        console.error("[ai-context-updater] suggestion failed", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, urgency: updated.urgency_score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-context-updater] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});