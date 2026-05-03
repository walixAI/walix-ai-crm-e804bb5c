import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  contactId: string;
}

interface AiSuggestion {
  id: string;
  text: string;
  cta: string;
  action: "whatsapp" | "task";
  priority: number;
  taskTitle?: string;
}

const TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "emit_contact_suggestions",
    description: "Devuelve 1-4 sugerencias accionables y específicas para el contacto.",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: {
                type: "string",
                description: "Sugerencia breve y específica (máx 180 caracteres) en español, mencionando al contacto por su nombre.",
              },
              cta: {
                type: "string",
                description: "Texto del botón de acción (ej. 'Reactivar conversación', 'Agendar llamada'). Máx 30 caracteres.",
              },
              action: {
                type: "string",
                enum: ["whatsapp", "task", "note"],
                description: "whatsapp = abre composer. task = abre diálogo de nueva tarea. note = registra una nota interna en el contacto.",
              },
              taskTitle: {
                type: "string",
                description: "Solo si action='task': título prellenado para la tarea.",
              },
              noteText: {
                type: "string",
                description: "Solo si action='note': contenido de la nota a registrar (máx 500 chars).",
              },
            },
            required: ["text", "cta", "action"],
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

async function callGateway(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) return { error: "Demasiadas solicitudes, intenta más tarde.", status: 429 };
  if (res.status === 402) return { error: "Sin créditos en Lovable AI.", status: 402 };
  if (!res.ok) {
    const t = await res.text();
    return { error: `Gateway error: ${res.status} ${t}`, status: 500 };
  }
  return { json: await res.json() };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const contactId = body?.contactId;
    if (!contactId || typeof contactId !== "string") {
      return new Response(JSON.stringify({ error: "contactId requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Gather context (RLS scoped to current user's tenant) ----
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("id, name, last_name, company, position, status, source, tags, last_activity_at, created_at")
      .eq("id", contactId)
      .maybeSingle();
    if (contactErr || !contact) {
      return new Response(JSON.stringify({ error: "Contacto no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [dealsRes, activitiesRes, convosRes] = await Promise.all([
      supabase.from("deals")
        .select("id, name, amount, probability, stage_name, is_won, is_lost, expected_close_date, updated_at")
        .eq("contact_id", contactId)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase.from("activities")
        .select("type, description, occurred_at")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(8),
      supabase.from("conversations")
        .select("id")
        .eq("contact_id", contactId),
    ]);

    const deals = dealsRes.data ?? [];
    const activities = activitiesRes.data ?? [];
    const convIds = (convosRes.data ?? []).map((c: any) => c.id);

    let lastMessages: any[] = [];
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("direction, body, sent_at, is_internal_note")
        .in("conversation_id", convIds)
        .order("sent_at", { ascending: false })
        .limit(10);
      lastMessages = (msgs ?? []).reverse();
    }

    const inactiveDays = daysSince(contact.last_activity_at);
    const ageDays = daysSince(contact.created_at);

    const transcript = lastMessages.length
      ? lastMessages
          .filter((m) => !m.is_internal_note)
          .map((m) => `${m.direction === "inbound" ? "Cliente" : "Vendedor"}: ${m.body}`)
          .join("\n")
      : "(sin mensajes)";

    const dealsSummary = deals.length
      ? deals
          .map((d: any) => {
            const status = d.is_won ? "GANADO" : d.is_lost ? "PERDIDO" : "ABIERTO";
            return `- "${d.name}" $${Number(d.amount).toLocaleString("es-MX")} · ${d.stage_name ?? "—"} · ${d.probability}% · ${status}${d.expected_close_date ? ` · cierra ${d.expected_close_date}` : ""}`;
          })
          .join("\n")
      : "(sin deals)";

    const activitySummary = activities.length
      ? activities.map((a: any) => `- ${a.type}: ${a.description} (${a.occurred_at})`).join("\n")
      : "(sin actividad)";

    const fullName = [contact.name, contact.last_name].filter(Boolean).join(" ");
    const userPrompt = `
Contacto: ${fullName}${contact.company ? ` (${contact.company})` : ""}
Estado: ${contact.status} · Fuente: ${contact.source}
Etiquetas: ${(contact.tags ?? []).join(", ") || "ninguna"}
Días desde última actividad: ${inactiveDays ?? "n/a"}
Antigüedad del contacto (días): ${ageDays ?? "n/a"}

Deals:
${dealsSummary}

Últimos eventos:
${activitySummary}

Conversación reciente (WhatsApp):
${transcript}
`.trim();

    const result = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            `Eres un asistente comercial para vendedores B2B en LATAM. Analiza la información del contacto y genera 1-4 sugerencias accionables, específicas y priorizadas (la primera = más importante). Cada sugerencia debe ser concreta (no genérica), corta (<180 chars), en español neutro. Usa action='whatsapp' cuando lo natural sea responder/enviar un mensaje, y action='task' cuando convenga agendar una llamada o tarea. REGLAS ESTRICTAS: (1) NUNCA inventes nombres de personas, empresas, montos, fechas o eventos. (2) El ÚNICO nombre de persona permitido es exactamente "${fullName || "el contacto"}". Si necesitas referirte al contacto, usa ese nombre o expresiones genéricas como "el contacto", "el cliente". (3) Solo puedes mencionar oportunidades que aparezcan en la sección "Deals". (4) Si no tienes información suficiente, devuelve UNA sola sugerencia genérica de seguimiento sin inventar datos. Llama a "Oportunidad" en lugar de "Deal".`,
        },
        { role: "user", content: userPrompt },
      ],
      tools: [TOOL_DEF],
      tool_choice: { type: "function", function: { name: "emit_contact_suggestions" } },
    });

    if ("error" in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const choice = result.json?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Respuesta IA inválida", suggestions: [] }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { suggestions?: Array<Omit<AiSuggestion, "id" | "priority">> } = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "JSON IA inválido", suggestions: [] }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    // Anti-hallucination: descartar sugerencias que mencionen nombres no presentes en el contexto.
    const allowedNames = new Set<string>();
    if (contact.name) allowedNames.add(String(contact.name).toLowerCase());
    if (contact.last_name) allowedNames.add(String(contact.last_name).toLowerCase());
    if (fullName) allowedNames.add(fullName.toLowerCase());
    const COMMON_WORDS = new Set([
      "WhatsApp","Cliente","Vendedor","Oportunidad","Oportunidades","Deal","Hola","Buenos","Buenas",
      "Llamada","Tarea","Mensaje","Correo","Email","Cotización","Llama","Envía","Agenda","Recordatorio",
      "Hoy","Mañana","Ayer","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo",
      "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
    ]);
    const namePattern = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/g;
    function hasInventedName(text: string): boolean {
      const matches = text.match(namePattern) ?? [];
      for (const m of matches) {
        if (COMMON_WORDS.has(m)) continue;
        if (allowedNames.has(m.toLowerCase())) continue;
        // permitir empresa del contacto
        if (contact.company && m.toLowerCase().includes(String(contact.company).toLowerCase().split(" ")[0])) continue;
        return true;
      }
      return false;
    }
    const filtered = raw.filter((s) => !hasInventedName(String(s.text ?? "")));
    const finalRaw = filtered.length ? filtered : (raw.length ? [{
      text: `Da seguimiento a ${fullName || "el contacto"}: revisa su última conversación y define el próximo paso.`,
      cta: "Abrir conversación",
      action: "whatsapp" as const,
    }] : []);
    const suggestions: AiSuggestion[] = finalRaw.slice(0, 4).map((s, i) => ({
      id: `ai-${i}`,
      text: String(s.text ?? "").slice(0, 240),
      cta: String(s.cta ?? "Ver acción").slice(0, 40),
      action: s.action === "task" ? "task" : "whatsapp",
      priority: 100 - i,
      ...(s.action === "task" && s.taskTitle ? { taskTitle: String(s.taskTitle).slice(0, 120) } : {}),
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contact-ai-suggest error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
