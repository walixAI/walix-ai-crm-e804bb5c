import { corsHeaders } from "@supabase/supabase-js/cors";

interface SetupRequest {
  industry: string;
  team_size?: string;
  sales_channel?: string;
}

interface StageSuggestion {
  name: string;
  color: string;
  is_won?: boolean;
  is_lost?: boolean;
}

interface Suggestion {
  pipeline_name: string;
  stages: StageSuggestion[];
  rationale: string;
}

const FALLBACK: Suggestion = {
  pipeline_name: "Pipeline de Ventas",
  rationale: "Pipeline B2B genérico",
  stages: [
    { name: "Nuevo Lead", color: "hsl(220 13% 65%)" },
    { name: "Calificado", color: "hsl(38 92% 50%)" },
    { name: "Propuesta", color: "hsl(217 91% 60%)" },
    { name: "Negociación", color: "hsl(262 83% 58%)" },
    { name: "Ganado", color: "hsl(142 76% 36%)", is_won: true },
    { name: "Perdido", color: "hsl(0 84% 60%)", is_lost: true },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SetupRequest;
    const industry = (body.industry || "Otro").slice(0, 100);
    const teamSize = (body.team_size || "1-5").slice(0, 20);
    const salesChannel = (body.sales_channel || "WhatsApp").slice(0, 50);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ...FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un experto en CRM para PyMEs latinoamericanas que venden por WhatsApp.
Diseña pipelines de ventas concretos según la industria del cliente.
Devuelve SIEMPRE 5 a 7 etapas. Las dos últimas DEBEN ser "Ganado" (is_won) y "Perdido" (is_lost).
Usa colores HSL del design system: gris "hsl(220 13% 65%)", ámbar "hsl(38 92% 50%)", azul "hsl(217 91% 60%)", violeta "hsl(262 83% 58%)", verde "hsl(142 76% 36%)", rojo "hsl(0 84% 60%)".`;

    const userPrompt = `Industria: ${industry}
Tamaño del equipo de ventas: ${teamSize}
Canal principal: ${salesChannel}

Sugiere el pipeline ideal para esta PyME.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_pipeline",
              description: "Devuelve el pipeline sugerido",
              parameters: {
                type: "object",
                properties: {
                  pipeline_name: { type: "string" },
                  rationale: { type: "string" },
                  stages: {
                    type: "array",
                    minItems: 5,
                    maxItems: 7,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        color: { type: "string" },
                        is_won: { type: "boolean" },
                        is_lost: { type: "boolean" },
                      },
                      required: ["name", "color"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["pipeline_name", "rationale", "stages"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_pipeline" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta en un momento." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga en Settings > Workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      console.error("AI error", aiResp.status, await aiResp.text());
      return new Response(JSON.stringify({ ...FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ ...FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments) as Suggestion;
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-onboarding-setup error", e);
    return new Response(JSON.stringify({ ...FALLBACK, fallback: true, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});