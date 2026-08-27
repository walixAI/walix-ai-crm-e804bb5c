// Traduce un prompt en español a condiciones estructuradas de campaña y devuelve una vista previa.
import { createClient } from "npm:@supabase/supabase-js@2";
import { matchContacts, type CampaignConditions } from "../_shared/wa-campaigns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conditions", "objective", "unresolved", "summary"],
  properties: {
    objective: { type: "string", enum: ["calificar", "agendar", "cotizar", "reactivar", "cobrar", "encuesta"] },
    summary: { type: "string" },
    unresolved: { type: "array", items: { type: "string" } },
    conditions: {
      type: "object",
      additionalProperties: false,
      required: ["source_kinds", "ga_channels", "utm_sources", "utm_campaigns", "cities", "regions", "products", "tags", "owner_ids", "stage_ids", "lifecycle", "no_reply_days", "created_within_days"],
      properties: {
        source_kinds: { type: "array", items: { type: "string" } },
        ga_channels: { type: "array", items: { type: "string" } },
        utm_sources: { type: "array", items: { type: "string" } },
        utm_campaigns: { type: "array", items: { type: "string" } },
        cities: { type: "array", items: { type: "string" } },
        regions: { type: "array", items: { type: "string" } },
        products: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        owner_ids: { type: "array", items: { type: "string" } },
        stage_ids: { type: "array", items: { type: "string" } },
        lifecycle: { type: "array", items: { type: "string" } },
        no_reply_days: { type: ["number", "null"] },
        created_within_days: { type: ["number", "null"] },
      },
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) return json({ error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt || prompt.length > 2000) return json({ error: "Escribe una descripción válida (máx. 2000 caracteres)" }, 400);

    const { data: profile } = await sb.from("profiles").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return json({ error: "Sin empresa asignada" }, 400);

    // Valores reales del tenant para que la IA no invente
    const [{ data: stages }, { data: owners }, { data: attrs }] = await Promise.all([
      sb.from("pipeline_stages").select("id, name").limit(50),
      sb.from("profiles").select("id, full_name").eq("tenant_id", tenantId).limit(50),
      sb.from("contact_attribution").select("ga_channel, city, region, utm_source, utm_campaign, source_kind").eq("tenant_id", tenantId).limit(500),
    ]);
    const uniq = (arr: (string | null)[]) => Array.from(new Set(arr.filter(Boolean) as string[])).slice(0, 40);
    const catalog = {
      etapas: (stages ?? []).map((s: any) => ({ id: s.id, nombre: s.name })),
      asesores: (owners ?? []).map((o: any) => ({ id: o.id, nombre: o.full_name })),
      canales_ga4: uniq((attrs ?? []).map((a: any) => a.ga_channel)),
      ciudades: uniq((attrs ?? []).map((a: any) => a.city)),
      estados: uniq((attrs ?? []).map((a: any) => a.region)),
      utm_sources: uniq((attrs ?? []).map((a: any) => a.utm_source)),
      utm_campaigns: uniq((attrs ?? []).map((a: any) => a.utm_campaign)),
      origenes: uniq((attrs ?? []).map((a: any) => a.source_kind)),
      ciclo_de_vida: ["prospecto", "cliente", "cliente_inactivo", "inactivo"],
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "IA no configurada" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres el traductor de reglas de segmentación de Walix CRM (español de México). Conviertes la descripción del usuario en condiciones estructuradas. " +
              "Usa ÚNICAMENTE valores que existan en el catálogo entregado; si algo del texto no se puede representar con esos campos, no lo inventes: agrégalo textual a 'unresolved'. " +
              "Arreglos vacíos cuando no aplique y null en los numéricos. 'summary' es una frase corta en español.",
          },
          { role: "user", content: `Catálogo del tenant:\n${JSON.stringify(catalog)}\n\nDescripción:\n${prompt}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "campaign_rule", strict: true, schema: SCHEMA } },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("gateway error", res.status, detail.slice(0, 400));
      if (res.status === 429) return json({ error: "Demasiadas solicitudes de IA, intenta en un momento." }, 429);
      if (res.status === 402) return json({ error: "Se agotaron los créditos de IA del espacio de trabajo." }, 402);
      return json({ error: "No se pudo interpretar el prompt", details: detail.slice(0, 300) }, res.status);
    }

    const out = await res.json();
    let parsed: any;
    try { parsed = JSON.parse(out?.choices?.[0]?.message?.content ?? "{}"); }
    catch { return json({ error: "Respuesta de IA no interpretable" }, 502); }

    const conditions = (parsed?.conditions ?? {}) as CampaignConditions;

    let total = 0;
    let sample: any[] = [];
    try {
      const { ids, total: t } = await matchContacts(sb, tenantId, conditions, 500);
      total = t;
      if (ids.length) {
        const { data: rows } = await sb.from("contacts").select("id, name, phone, company").in("id", ids.slice(0, 10));
        sample = rows ?? [];
      }
    } catch (e) {
      console.error("preview failed", e);
    }

    return json({
      conditions,
      objective: parsed?.objective ?? "calificar",
      unresolved: parsed?.unresolved ?? [],
      summary: parsed?.summary ?? "",
      preview: { total, sample },
    });
  } catch (e) {
    console.error("rule-ai error", e);
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
