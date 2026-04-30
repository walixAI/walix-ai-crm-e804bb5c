import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  tenant_id: string;
  industry?: string;
}

const DEFAULT_TAGS: { name: string; family: "lifecycle" | "priority" | "special"; icon?: string }[] = [
  { name: "Nuevo", family: "lifecycle", icon: "sparkles" },
  { name: "Activo", family: "lifecycle", icon: "circle-check" },
  { name: "Inactivo", family: "lifecycle", icon: "moon" },
  { name: "VIP", family: "priority", icon: "crown" },
  { name: "Caliente", family: "priority", icon: "flame" },
  { name: "Frío", family: "priority", icon: "snowflake" },
  { name: "Recurrente", family: "special", icon: "repeat" },
  { name: "Referido", family: "special", icon: "users" },
];

async function generateTagsWithAI(industry: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return DEFAULT_TAGS;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "Generas etiquetas de segmentación de contactos para CRMs de PyMEs latinoamericanas. Devuelve etiquetas cortas (1-2 palabras), específicas a la industria, sin emojis. Mezcla familias: 'lifecycle' (etapa de vida), 'priority' (prioridad/temperatura) y 'special' (segmento o atributo del sector).",
          },
          {
            role: "user",
            content: `Industria: ${industry}. Devuelve 8 etiquetas útiles para clasificar contactos en este sector.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_tags",
              parameters: {
                type: "object",
                properties: {
                  tags: {
                    type: "array",
                    minItems: 6,
                    maxItems: 10,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        family: { type: "string", enum: ["lifecycle", "priority", "special"] },
                        icon: { type: "string" },
                      },
                      required: ["name", "family"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_tags" } },
      }),
    });
    if (!resp.ok) return DEFAULT_TAGS;
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return DEFAULT_TAGS;
    const parsed = JSON.parse(args);
    return parsed.tags as { name: string; family: "lifecycle" | "priority" | "special"; icon?: string }[];
  } catch {
    return DEFAULT_TAGS;
  }
}

function fallbackTemplates(industry: string) {
  return [
    {
      name: "Saludo inicial",
      category: "saludo",
      content: `¡Hola {{nombre}}! 👋 Gracias por contactarnos. Soy de ${industry || "nuestro equipo"} y estoy aquí para ayudarte. ¿En qué puedo apoyarte hoy?`,
    },
    {
      name: "Seguimiento 24h",
      category: "seguimiento",
      content: `Hola {{nombre}}, te escribo para saber si tuviste oportunidad de revisar la información que te envié. ¿Tienes alguna duda?`,
    },
    {
      name: "Cierre / propuesta",
      category: "cierre",
      content: `{{nombre}}, te comparto la propuesta final. Si todo está bien para ti, podemos avanzar con el siguiente paso hoy mismo. ¿Te parece?`,
    },
  ];
}

async function generateTemplatesWithAI(industry: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return fallbackTemplates(industry);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "Generas plantillas cortas de WhatsApp específicas a la industria del cliente, para PyMEs latinoamericanas. Usa {{nombre}} como variable. Tono cálido y profesional, máx. 280 caracteres por plantilla. El campo 'name' debe describir el momento del flujo de venta (ej. 'Bienvenida visita inmueble', 'Cotización seguro auto', 'Recordatorio cita'). 'category' debe ser una palabra corta (ej. 'saludo', 'seguimiento', 'cierre', 'recordatorio', 'agradecimiento').",
          },
          {
            role: "user",
            content: `Industria: ${industry}. Devuelve entre 4 y 6 plantillas representativas del flujo de ventas en este sector.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_templates",
              parameters: {
                type: "object",
                properties: {
                  templates: {
                    type: "array",
                    minItems: 4,
                    maxItems: 6,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string" },
                        content: { type: "string" },
                      },
                      required: ["name", "category", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["templates"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_templates" } },
      }),
    });
    if (!resp.ok) return fallbackTemplates(industry);
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return fallbackTemplates(industry);
    const parsed = JSON.parse(args);
    return parsed.templates as { name: string; category: string; content: string }[];
  } catch {
    return fallbackTemplates(industry);
  }
}

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
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente para validar el JWT del invocador
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const body = (await req.json()) as Body;
    if (!body.tenant_id) {
      return new Response(JSON.stringify({ error: "missing_tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el usuario pertenezca al tenant
    const { data: profile } = await userClient
      .from("profiles")
      .select("tenant_id, active_tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const userTenant = profile?.active_tenant_id ?? profile?.tenant_id;
    if (userTenant !== body.tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const industry = (body.industry || "Otro").slice(0, 100);

    // 1) Tags dinámicas por industria
    const tags = await generateTagsWithAI(industry);
    const tagRows = tags.map((t) => ({
      tenant_id: body.tenant_id,
      name: t.name.slice(0, 60),
      family: t.family ?? "special",
      icon: t.icon,
    }));
    const { error: tagErr } = await admin
      .from("contact_tags")
      .upsert(tagRows, { onConflict: "tenant_id,name", ignoreDuplicates: true });
    if (tagErr) console.error("tag insert", tagErr);

    // 2) Plantillas (con IA)
    const templates = await generateTemplatesWithAI(industry);
    const tplRows = templates.map((t) => ({
      tenant_id: body.tenant_id,
      name: t.name,
      category: t.category,
      content: t.content,
      created_by: user.id,
    }));
    const { error: tplErr } = await admin
      .from("message_templates")
      .upsert(tplRows, { onConflict: "tenant_id,name", ignoreDuplicates: true });
    if (tplErr) console.error("tpl insert", tplErr);

    // 3) Automatización demo (deshabilitada)
    const { data: existing } = await admin
      .from("automations")
      .select("id")
      .eq("tenant_id", body.tenant_id)
      .eq("name", "Auto-saludo a nuevo lead")
      .maybeSingle();

    if (!existing) {
      await admin.from("automations").insert({
        tenant_id: body.tenant_id,
        name: "Auto-saludo a nuevo lead",
        description: "Envía el saludo inicial de WhatsApp cuando se cree un contacto nuevo desde WhatsApp.",
        icon: "message-circle",
        enabled: false,
        is_draft: true,
        trigger_type: "contact_created",
        trigger_config: { source: "WhatsApp" },
        conditions: [],
        actions: [{ type: "send_whatsapp_template", template: "Saludo inicial" }],
        created_by: user.id,
      });
    }

    // Nombre de la primera plantilla (para que la automatización use una real)
    const firstTemplateName = templates[0]?.name ?? "Saludo inicial";

    return new Response(
      JSON.stringify({
        ok: true,
        tags: tagRows.length,
        tag_names: tagRows.map((t) => t.name),
        templates: tplRows.length,
        template_names: tplRows.map((t) => t.name),
        automations: existing ? 0 : 1,
        first_template: firstTemplateName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("onboarding-seed error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});