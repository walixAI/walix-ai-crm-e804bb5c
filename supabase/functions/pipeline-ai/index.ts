import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DealLite {
  id: string;
  name: string;
  amount: number;
  probability: number;
  stageName: string;
  isWon: boolean;
  isLost: boolean;
  daysInStage?: number;
  daysSinceContact?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  source?: string;
}

type Mode = "analyze_pipeline" | "suggest_next_step" | "score_probability" | "bulk_suggest";

async function callGateway(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    return { error: "Demasiadas solicitudes, intenta de nuevo en un momento.", status: 429 };
  }
  if (res.status === 402) {
    return { error: "Sin créditos en Lovable AI. Agrega créditos en Settings → Workspace → Usage.", status: 402 };
  }
  if (!res.ok) {
    const t = await res.text();
    console.error("Gateway error", res.status, t);
    return { error: "Error del modelo de IA", status: 500 };
  }
  return { data: await res.json(), status: 200 };
}

function extractToolArgs(json: any): any | null {
  const msg = json?.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (!call?.function?.arguments) return null;
  try { return JSON.parse(call.function.arguments); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, deals, deal } = await req.json() as {
      mode: Mode;
      deals?: DealLite[];
      deal?: DealLite;
    };

    if (mode === "analyze_pipeline") {
      if (!Array.isArray(deals) || deals.length === 0) {
        return new Response(JSON.stringify({ error: "Sin deals para analizar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const compact = deals.slice(0, 80).map(d => ({
        n: d.name, a: d.amount, p: d.probability, s: d.stageName,
        dis: d.daysInStage ?? 0, dsc: d.daysSinceContact ?? null, ecd: d.expectedCloseDate,
      }));
      const result = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un coach de ventas. Analiza un pipeline B2B en español y devuelves insights breves y accionables. Sé directo y específico." },
          { role: "user", content: `Pipeline (resumen JSON, n=name, a=monto MXN, p=prob%, s=etapa, dis=días en etapa, dsc=días desde último contacto, ecd=fecha cierre):\n${JSON.stringify(compact)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_pipeline_analysis",
            description: "Genera un análisis del pipeline",
            parameters: {
              type: "object",
              properties: {
                health_score: { type: "integer", minimum: 0, maximum: 100, description: "Salud global del pipeline 0-100" },
                summary: { type: "string", description: "Resumen ejecutivo en 2-3 frases" },
                risks: {
                  type: "array", maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      detail: { type: "string" },
                    },
                    required: ["title", "severity", "detail"],
                    additionalProperties: false,
                  },
                },
                recommendations: {
                  type: "array", maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      action: { type: "string", description: "Acción concreta a tomar" },
                      impact: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["title", "action", "impact"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["health_score", "summary", "risks", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_pipeline_analysis" } },
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const args = extractToolArgs(result.data);
      if (!args) {
        return new Response(JSON.stringify({ error: "Respuesta inválida del modelo" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "bulk_suggest") {
      if (!Array.isArray(deals) || deals.length === 0) {
        return new Response(JSON.stringify({ error: "Sin deals para sugerir" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // Resolve user's tenant via profiles (RLS allows reading own profile)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const tenantId = profile?.tenant_id;
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Sin tenant" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Limit to top 15 deals to keep latency/cost reasonable
      const targets = deals.slice(0, 15);
      const result = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un asesor de ventas en español. Para cada deal sugieres UNA acción concreta para avanzarlo. Sé específico y breve (máx 100 chars por acción)." },
          { role: "user", content: `Sugiere siguiente paso para cada deal. JSON:\n${JSON.stringify(targets)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "bulk_suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      deal_id: { type: "string" },
                      next_step: { type: "string", description: "Acción concreta (máx 100 chars)" },
                      cta_label: { type: "string", description: "Texto corto botón (máx 25 chars)" },
                      urgency: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["deal_id", "next_step", "cta_label", "urgency"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "bulk_suggestions" } },
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const args = extractToolArgs(result.data);
      const suggestions: Array<{ deal_id: string; next_step: string; cta_label: string; urgency: string }> = args?.suggestions ?? [];
      const validIds = new Set(targets.map(d => d.id));
      const rows = suggestions
        .filter(s => validIds.has(s.deal_id))
        .map(s => ({
          tenant_id: tenantId,
          deal_id: s.deal_id,
          text: s.next_step,
          cta: s.cta_label,
          kind: `ai_next_step_${s.urgency}`,
          dismissed: false,
        }));

      if (rows.length > 0) {
        // Replace previous AI next-step suggestions for these deals
        await supabase
          .from("ai_suggestions")
          .delete()
          .in("deal_id", rows.map(r => r.deal_id))
          .like("kind", "ai_next_step_%");
        const { error: insErr } = await supabase.from("ai_suggestions").insert(rows);
        if (insErr) {
          console.error("insert ai_suggestions error", insErr);
          return new Response(JSON.stringify({ error: insErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ count: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "suggest_next_step" || mode === "score_probability") {
      if (!deal) {
        return new Response(JSON.stringify({ error: "Falta el deal" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (mode === "suggest_next_step") {
        const result = await callGateway({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Eres un asesor de ventas en español. Sugieres el siguiente paso concreto para avanzar un deal. Una sola acción, clara y específica." },
            { role: "user", content: `Deal:\n${JSON.stringify(deal)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "suggest_next_step",
              parameters: {
                type: "object",
                properties: {
                  next_step: { type: "string", description: "Acción concreta a hacer ahora (1-2 frases)" },
                  reasoning: { type: "string", description: "Por qué se recomienda esta acción (1 frase)" },
                  cta_label: { type: "string", description: "Texto corto para el botón (máx 25 chars)" },
                  urgency: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["next_step", "reasoning", "cta_label", "urgency"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "suggest_next_step" } },
        });
        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const args = extractToolArgs(result.data);
        return new Response(JSON.stringify(args ?? { error: "Respuesta inválida" }), {
          status: args ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // score_probability
      const result = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un experto en forecast de ventas B2B. Calculas la probabilidad de cierre (0-100) basándote en señales: días en etapa, días desde contacto, monto, fecha esperada de cierre y notas. Sé conservador y realista." },
          { role: "user", content: `Deal:\n${JSON.stringify(deal)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_probability",
            parameters: {
              type: "object",
              properties: {
                probability: { type: "integer", minimum: 0, maximum: 100 },
                reasoning: { type: "string", description: "Justificación breve (1-2 frases)" },
                signals: { type: "array", items: { type: "string" }, maxItems: 4, description: "Señales clave consideradas" },
              },
              required: ["probability", "reasoning", "signals"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_probability" } },
      });
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const args = extractToolArgs(result.data);
      return new Response(JSON.stringify(args ?? { error: "Respuesta inválida" }), {
        status: args ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Modo inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pipeline-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});