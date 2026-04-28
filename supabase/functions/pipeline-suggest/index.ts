import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  business: string;
}

const TOOL = {
  type: "function",
  function: {
    name: "suggest_pipeline",
    description: "Sugiere una configuración de pipeline para el negocio descrito.",
    parameters: {
      type: "object",
      properties: {
        stages: {
          type: "array",
          minItems: 4,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre corto de la etapa, en español." },
              probability: { type: "integer", minimum: 0, maximum: 100, description: "Probabilidad típica de cierre en esta etapa." },
            },
            required: ["name", "probability"],
            additionalProperties: false,
          },
        },
        customFields: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              type: { type: "string", enum: ["text", "number", "date", "select"] },
              reason: { type: "string", description: "Por qué este campo es útil para este negocio." },
            },
            required: ["label", "type", "reason"],
            additionalProperties: false,
          },
        },
        automations: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              trigger: { type: "string", description: "Disparador, ej. 'Cuando un lead lleva 3 días sin respuesta'." },
              action: { type: "string", description: "Acción sugerida, ej. 'Enviar recordatorio por WhatsApp'." },
            },
            required: ["trigger", "action"],
            additionalProperties: false,
          },
        },
      },
      required: ["stages", "customFields", "automations"],
      additionalProperties: false,
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
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.business?.trim()) {
      return new Response(JSON.stringify({ error: "Falta 'business'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres consultor experto en CRM para PyMEs en México. " +
              "Diseñas pipelines de ventas concretos y accionables, en español. " +
              "Las etapas deben ser específicas para el negocio descrito (no genéricas). " +
              "Los campos personalizados deben capturar información que ese negocio realmente necesita. " +
              "Las automatizaciones deben ser realistas para WhatsApp + CRM.",
          },
          { role: "user", content: `Negocio del usuario: ${body.business}\n\nDevuelve la configuración llamando a suggest_pipeline.` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "suggest_pipeline" } },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta de nuevo." }), {
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
    if (!call) {
      return new Response(JSON.stringify({ error: "Sin respuesta estructurada del modelo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments || "{}");
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pipeline-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});