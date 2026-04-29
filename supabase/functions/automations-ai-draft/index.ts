// Edge function: convierte una descripción en lenguaje natural en un borrador
// estructurado de automatización. Usa Lovable AI Gateway con tool-calling para
// asegurar JSON válido.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIGGER_TYPES = [
  "deal_inactive", "new_whatsapp_lead", "new_contact", "deal_stage_changed",
  "deal_won", "deal_lost", "deal_close_date_near", "contact_no_reply",
] as const;

const ACTION_TYPES = [
  "send_whatsapp", "notify_owner", "create_task", "reassign_contact",
  "add_tag", "move_deal_stage",
] as const;

const SYSTEM = `Eres Walix.ai, un asistente que diseña automatizaciones de CRM en español.
Recibirás una frase del usuario describiendo una automatización deseada y debes convertirla en
un objeto JSON estructurado llamando a la función "draft_automation".

Reglas:
- Elige UN trigger entre: ${TRIGGER_TYPES.join(", ")}.
- Si el trigger usa días (deal_inactive, deal_close_date_near, contact_no_reply), incluye {"days": N} en triggerConfig.
- Para deal_stage_changed usa {"fromStageId": "any", "toStageId": "any"} salvo que se indique.
- Acciones permitidas: ${ACTION_TYPES.join(", ")}.
- Si menciona "vendedor con menos leads" o similar, usa reassign_contact con strategy round_robin.
- Si pide "avisar/notificar", usa notify_owner.
- Si pide enviar WhatsApp, usa send_whatsapp con templateId null (el usuario elegirá luego).
- Genera un nombre corto y una descripción amigable de una sola línea.
- Las condiciones son opcionales; usa array vacío si no aplica.`;

const TOOL = {
  type: "function",
  function: {
    name: "draft_automation",
    description: "Devuelve el borrador de la automatización.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        triggerType: { type: "string", enum: TRIGGER_TYPES },
        triggerConfig: { type: "object" },
        conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: { type: "string" },
              value: { type: "string" },
            },
            required: ["field", "operator", "value"],
          },
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ACTION_TYPES },
              config: { type: "object" },
            },
            required: ["type", "config"],
          },
        },
      },
      required: ["name", "description", "triggerType", "triggerConfig", "conditions", "actions"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt vacío" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "draft_automation" } },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta de nuevo en un momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Sin créditos en Lovable AI." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `Gateway error: ${res.status} ${t}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "La IA no devolvió un borrador válido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any;
    try { parsed = typeof args === "string" ? JSON.parse(args) : args; }
    catch { return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    return new Response(JSON.stringify({ draft: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});