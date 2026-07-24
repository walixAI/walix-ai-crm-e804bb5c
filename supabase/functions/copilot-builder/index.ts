// Edge Function: copilot-builder
// "Walix Builder" — asistente que ayuda al admin a componer capacidades del
// Copiloto por chat, a partir del catálogo de primitivas ya soportadas.
// No ejecuta acciones del CRM; sólo genera y guarda recetas.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";

// Catálogo de primitivas disponibles (debe coincidir con lo que ai-copilot
// puede ejecutar). Cada primitiva es un "paso" reutilizable en una receta.
const PRIMITIVES = [
  { id: "search_contacts", label: "Buscar contactos", risk: "read" },
  { id: "get_contact_context", label: "Leer contexto de contacto", risk: "read" },
  { id: "get_pipeline_status", label: "Consultar pipeline", risk: "read" },
  { id: "get_my_tasks", label: "Consultar pendientes", risk: "read" },
  { id: "get_my_deals", label: "Consultar oportunidades", risk: "read" },
  { id: "get_profitability", label: "Consultar rentabilidad", risk: "read" },
  { id: "get_run_rate", label: "Consultar run-rate", risk: "read" },
  { id: "get_expenses_summary", label: "Consultar gastos", risk: "read" },
  { id: "get_monthly_goal", label: "Consultar meta del mes", risk: "read" },
  { id: "get_team_performance", label: "Consultar equipo", risk: "read" },
  { id: "create_contact", label: "Crear contacto", risk: "write" },
  { id: "create_deal", label: "Crear oportunidad / deal", risk: "write" },
  { id: "move_deal_stage", label: "Mover deal de etapa", risk: "write" },
  { id: "add_note", label: "Agregar nota", risk: "write" },
  { id: "create_task", label: "Crear tarea / pendiente", risk: "write" },
  { id: "prepare_whatsapp_message", label: "Preparar borrador de WhatsApp", risk: "write" },
  { id: "set_monthly_goal", label: "Ajustar meta del mes", risk: "write" },
];

const SYSTEM_PROMPT = `Eres "Walix Builder", el arquitecto de capacidades del Copiloto Walix.

Tu único trabajo: ayudar al administrador de un tenant a componer una nueva capacidad (receta) para el Copiloto, encadenando primitivas del catálogo. NO ejecutas acciones del CRM. NO respondes preguntas fuera de este alcance — si el usuario pregunta otra cosa, redirígelo amablemente.

Catálogo de primitivas disponibles (usa solo estos ids):
${PRIMITIVES.map((p) => `- ${p.id} [${p.risk}]: ${p.label}`).join("\n")}

Flujo obligatorio:
1. Entiende el objetivo del admin en 1-2 mensajes.
2. Propón una receta como lista numerada de pasos, usando SOLO ids del catálogo. Máximo 5 pasos.
3. Si el objetivo requiere una acción que no está en el catálogo, dilo y sugiere registrar la solicitud.
4. Confirma el orden y ajusta si el admin lo pide.
5. Haz UNA a UNA estas preguntas de seguridad:
   a) ¿Quién puede usarla? (todos, solo vendedores, solo gerentes, usuarios específicos)
   b) ¿Desde qué canal? (web, WhatsApp, ambos)
   c) ¿Requiere confirmación antes de ejecutar? (recomendado sí para pasos con [write])
   d) ¿Límite diario por usuario? (sin límite o número)
   e) Nombre corto de la capacidad
   f) 2-3 frases de disparo con las que un vendedor la invocaría
6. Cuando tengas TODO, devuelve un mensaje final que empiece con la línea literal:
   \`\`\`
   RECIPE_READY
   \`\`\`
   seguida INMEDIATAMENTE de un bloque JSON válido con esta forma:
   {
     "name": "...",
     "description": "...",
     "steps": [{"tool":"<id_primitiva>","note":"breve nota humana"}, ...],
     "trigger_phrases": ["...","..."],
     "scope_type": "all" | "role" | "user",
     "scope_roles": ["tenant_admin","tenant_owner","tenant_user"],
     "scope_user_ids": [],
     "channels": ["web","whatsapp"],
     "require_confirmation": true,
     "daily_limit": null
   }
   El JSON debe ir en un bloque \`\`\`json ... \`\`\`. Después del JSON, escribe una línea con "¿Quieres probarla (dry run) o activarla ya?".

Reglas duras:
- Máx. 5 pasos por receta.
- No inventes tools que no estén en el catálogo.
- No ejecutes nada; solo compones y guardas cuando el admin confirme desde la UI.
- Si el admin pide algo destructivo masivo (borrar contactos, borrar deals), rechaza y explica.
- Responde siempre en español, tono claro y ejecutivo.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await sb.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: prof } = await sb
      .from("profiles")
      .select("active_tenant_id, tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
    if (!tenantId) return json({ error: "no tenant" }, 400);

    // Verify admin
    const { data: roles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleList = (roles ?? []).map((r: any) => r.role);
    const isAdmin = roleList.some((r) =>
      ["tenant_admin", "tenant_owner", "platform_owner", "platform_staff", "super_admin"].includes(r),
    );
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const action = body.action ?? "chat";

    if (action === "chat") {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const chatMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ];

      const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages: chatMessages, temperature: 0.3 }),
      });
      if (!gwRes.ok) {
        const err = await gwRes.text();
        return json({ error: "ai_gateway_error", detail: err, status: gwRes.status }, gwRes.status === 429 ? 429 : gwRes.status === 402 ? 402 : 500);
      }
      const data = await gwRes.json();
      const reply = data.choices?.[0]?.message?.content ?? "";
      return json({ reply });
    }

    if (action === "save") {
      const r = body.recipe ?? {};
      const validSteps = Array.isArray(r.steps)
        ? r.steps.filter((s: any) => PRIMITIVES.some((p) => p.id === s.tool)).slice(0, 5)
        : [];
      if (!r.name || validSteps.length === 0) {
        return json({ error: "invalid_recipe" }, 400);
      }
      const insert = {
        tenant_id: tenantId,
        name: String(r.name).slice(0, 120),
        description: r.description ? String(r.description).slice(0, 500) : null,
        kind: "recipe",
        recipe_json: { steps: validSteps },
        trigger_phrases: Array.isArray(r.trigger_phrases) ? r.trigger_phrases.slice(0, 8).map((x: any) => String(x).slice(0, 200)) : [],
        scope_type: ["all", "role", "user"].includes(r.scope_type) ? r.scope_type : "all",
        scope_roles: Array.isArray(r.scope_roles) ? r.scope_roles.map(String) : [],
        scope_user_ids: Array.isArray(r.scope_user_ids) ? r.scope_user_ids.map(String) : [],
        channels: Array.isArray(r.channels) && r.channels.length ? r.channels.map(String) : ["web"],
        require_confirmation: r.require_confirmation !== false,
        daily_limit: typeof r.daily_limit === "number" ? r.daily_limit : null,
        is_active: r.is_active !== false,
        created_by: user.id,
      };
      const { data: saved, error } = await sb
        .from("copilot_capabilities")
        .insert(insert)
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: saved.id });
    }

    if (action === "primitives") {
      return json({ primitives: PRIMITIVES });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}