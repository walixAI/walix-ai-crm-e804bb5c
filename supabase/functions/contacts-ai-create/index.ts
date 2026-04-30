import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeMxPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("52") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+52${digits}`;
  return `+${digits}`;
}

const VALID_SOURCES = ["WhatsApp", "Formulario web", "Referido", "Manual"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const prompt = String(body?.prompt ?? "").slice(0, 500).trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "missing_prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant del usuario
    const { data: profile } = await userClient
      .from("profiles")
      .select("tenant_id, active_tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const tenantId = profile?.active_tenant_id ?? profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "no_tenant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Llamar IA con tool calling
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "ai_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Extraes datos de contacto en español de un texto libre. Devuelve los campos detectados; usa null si falta. El teléfono debe ser solo dígitos (sin +, espacios ni guiones).",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_contact",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nombre de pila" },
                  last_name: { type: ["string", "null"] },
                  phone: { type: "string", description: "Solo dígitos" },
                  email: { type: ["string", "null"] },
                  company: { type: ["string", "null"] },
                  position: { type: ["string", "null"] },
                  source: {
                    type: "string",
                    enum: VALID_SOURCES,
                    description: "Origen del lead",
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Etiquetas mencionadas (ej. VIP, Caliente)",
                  },
                },
                required: ["name", "phone"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_contact" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "insufficient_credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "no_extraction", message: "No pude entender el contacto. Intenta: 'Crea el contacto Juan González con teléfono 5512345678'." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const phone = normalizeMxPhone(parsed.phone || "");
    if (!parsed.name || !phone) {
      return new Response(
        JSON.stringify({ error: "missing_required", message: "Necesito al menos nombre y teléfono." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const source = VALID_SOURCES.includes(parsed.source) ? parsed.source : "Manual";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: any) => typeof t === "string").slice(0, 5)
      : [];

    // Insertar usando el JWT del usuario (respeta RLS)
    const { data: inserted, error } = await userClient
      .from("contacts")
      .insert({
        tenant_id: tenantId,
        name: String(parsed.name).slice(0, 100),
        last_name: parsed.last_name ? String(parsed.last_name).slice(0, 100) : null,
        phone,
        email: parsed.email ? String(parsed.email).slice(0, 200) : null,
        company: parsed.company ? String(parsed.company).slice(0, 200) : null,
        position: parsed.position ? String(parsed.position).slice(0, 200) : null,
        source,
        status: "Nuevo",
        tags,
        owner_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("insert contact error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, contact: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contacts-ai-create error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});