import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  mode: "ask";
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

async function callGateway(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) return { error: "Demasiadas solicitudes, intenta de nuevo en un momento.", status: 429 };
  if (res.status === 402) return { error: "Sin créditos en Lovable AI. Agrega créditos en Settings → Workspace → Usage.", status: 402 };
  if (!res.ok) {
    const t = await res.text();
    return { error: `Gateway error: ${res.status} ${t}`, status: 500 };
  }
  const json = await res.json();
  return { json };
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
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt vacío" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Gather lightweight tenant context (RLS scoped) ----
    const [dealsRes, convosRes, contactsRes, stagesRes] = await Promise.all([
      supabase.from("deals")
        .select("id, name, amount, probability, stage_name, is_won, is_lost, last_activity_at, created_at, owner_id")
        .eq("is_won", false).eq("is_lost", false)
        .order("amount", { ascending: false })
        .limit(40),
      supabase.from("conversations")
        .select("id, contact_id, status, unread_count, preview, last_message_at, assignee_id")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase.from("contacts")
        .select("id, name, company, last_activity_at")
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase.from("pipeline_stages")
        .select("id, name, is_won, is_lost, position")
        .order("position", { ascending: true })
        .limit(30),
    ]);

    const deals = dealsRes.data ?? [];
    const convos = convosRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const stages = stagesRes.data ?? [];

    // ---- Compact summary fed to the model ----
    const totalPipeline = deals.reduce((s, d: any) => s + Number(d.amount ?? 0), 0);
    const now = Date.now();
    const stale = deals.filter((d: any) => {
      const last = d.last_activity_at ? new Date(d.last_activity_at).getTime() : new Date(d.created_at).getTime();
      return (now - last) / 86_400_000 > 10;
    });
    const unreadConvos = convos.filter((c: any) => (c.unread_count ?? 0) > 0).length;

    const ctx = [
      `# Contexto del CRM (datos reales del tenant)`,
      `- Deals activos: ${deals.length}, valor total: ${fmtMXN(totalPipeline)}`,
      `- Deals sin actividad >10 días: ${stale.length}`,
      `- Conversaciones recientes: ${convos.length} (${unreadConvos} con mensajes sin leer)`,
      ``,
      `## Top deals activos (max 15)`,
      ...deals.slice(0, 15).map((d: any) =>
        `- ${d.name} · ${fmtMXN(Number(d.amount ?? 0))} · ${d.stage_name ?? "—"} · prob ${d.probability ?? 0}% · últ. actividad ${d.last_activity_at ?? d.created_at}`),
      ``,
      `## Conversaciones recientes (max 10)`,
      ...convos.slice(0, 10).map((c: any) => {
        const cn = contacts.find((k: any) => k.id === c.contact_id);
        return `- ${cn?.name ?? "—"} · estado ${c.status ?? "—"} · sin leer ${c.unread_count ?? 0} · "${(c.preview ?? "").slice(0, 60)}"`;
      }),
    ].join("\n");

    // Build a catalog of entity IDs the model is allowed to reference in actions.
    const dealCatalog = deals.slice(0, 15).map((d: any) => ({ id: d.id, name: d.name }));
    const convoCatalog = convos.slice(0, 10).map((c: any) => {
      const cn = contacts.find((k: any) => k.id === c.contact_id);
      return { id: c.id, contactName: cn?.name ?? "—" };
    });
    const contactCatalog = contacts.slice(0, 15).map((k: any) => ({ id: k.id, name: k.name }));
    const stageCatalog = stages.map((s: any) => ({ id: s.id, name: s.name, is_won: s.is_won, is_lost: s.is_lost }));

    const messages = [
      {
        role: "system",
        content:
          "Eres Walix.ai, el asistente de ventas del usuario en español (México). " +
          "Respondes de forma concisa, accionable y honesta usando ÚNICAMENTE el contexto del CRM proporcionado. " +
          "Si la pregunta no se puede responder con ese contexto, dilo brevemente. " +
          "Formato Markdown: negritas en nombres, listas cortas, montos en MXN. Máx 180 palabras. " +
          "Cuando menciones deals, conversaciones o contactos del catálogo, usa la herramienta `suggest_actions` " +
          "para proponer 1-4 botones de navegación. Nunca inventes IDs. " +
          "Cuando menciones inline el nombre de un deal/contacto/conversación del catálogo, envuélvelo con: " +
          "`[deal:UUID|Nombre]`, `[contact:UUID|Nombre]`, `[convo:UUID|Nombre]`. Usa SOLO UUIDs del catálogo.\n\n" +
          "REGLA CRÍTICA DE EJECUCIÓN: cuando el usuario pida HACER algo (mover deal, crear tarea, marcar ganado/perdido, " +
          "actualizar contacto, registrar nota), NO afirmes que ya lo hiciste. En su lugar llama a la herramienta " +
          "`propose_*` correspondiente con los datos exactos. La acción se ejecuta SOLO cuando el usuario la confirme en la UI. " +
          "En el texto, anuncia brevemente: 'Preparé este cambio para que lo confirmes.' " +
          "Puedes proponer hasta 3 cambios por turno. Usa SOLO IDs presentes en los catálogos.",
      },
      { role: "system", content: ctx },
      {
        role: "system",
        content:
          "Catálogo de IDs válidos (usa SOLO estos):\n" +
          `Deals: ${JSON.stringify(dealCatalog)}\n` +
          `Conversaciones: ${JSON.stringify(convoCatalog)}\n` +
          `Contactos: ${JSON.stringify(contactCatalog)}\n` +
          `Etapas de pipeline: ${JSON.stringify(stageCatalog)}`,
      },
      ...(body.history ?? []).slice(-4),
      { role: "user", content: body.prompt },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_actions",
          description: "Propone botones accionables al usuario para abrir entidades del CRM relacionadas con la respuesta.",
          parameters: {
            type: "object",
            properties: {
              actions: {
                type: "array",
                maxItems: 4,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Texto corto del botón (máx 32 chars)" },
                    type: { type: "string", enum: ["open_deal", "open_contact", "open_conversation", "open_pipeline", "open_inbox"] },
                    id: { type: "string", description: "UUID de la entidad. Omitir para open_pipeline / open_inbox." },
                  },
                  required: ["label", "type"],
                },
              },
            },
            required: ["actions"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_update_deal_stage",
          description: "Propone mover un deal a otra etapa del pipeline. Requiere confirmación humana.",
          parameters: {
            type: "object",
            properties: {
              deal_id: { type: "string", description: "UUID del deal (catálogo Deals)" },
              stage_id: { type: "string", description: "UUID de la etapa destino (catálogo Etapas)" },
              summary: { type: "string", description: "Resumen humano: 'Mover **Acme** a Negociación'" },
            },
            required: ["deal_id", "stage_id", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_update_deal_amount",
          description: "Propone cambiar monto y/o probabilidad de un deal.",
          parameters: {
            type: "object",
            properties: {
              deal_id: { type: "string" },
              amount: { type: "number", minimum: 0 },
              probability: { type: "number", minimum: 0, maximum: 100 },
              summary: { type: "string" },
            },
            required: ["deal_id", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_close_deal",
          description: "Propone cerrar un deal como ganado o perdido. Si es perdido, exige lost_reason.",
          parameters: {
            type: "object",
            properties: {
              deal_id: { type: "string" },
              outcome: { type: "string", enum: ["won", "lost"] },
              lost_reason: { type: "string" },
              lost_comment: { type: "string" },
              summary: { type: "string" },
            },
            required: ["deal_id", "outcome", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_create_task",
          description: "Propone crear una tarea (opcionalmente vinculada a un deal o contacto).",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              due_at: { type: "string", description: "ISO 8601 timestamp" },
              deal_id: { type: "string" },
              contact_id: { type: "string" },
              summary: { type: "string" },
            },
            required: ["title", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_create_activity",
          description: "Propone registrar una actividad/nota manual.",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["note", "deal", "task", "wa_sent", "wa_received"] },
              description: { type: "string" },
              deal_id: { type: "string" },
              contact_id: { type: "string" },
              summary: { type: "string" },
            },
            required: ["type", "description", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_update_contact",
          description: "Propone actualizar campos básicos de un contacto.",
          parameters: {
            type: "object",
            properties: {
              contact_id: { type: "string" },
              name: { type: "string" },
              last_name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              company: { type: "string" },
              position: { type: "string" },
              status: { type: "string", enum: ["Nuevo", "Contactado", "Calificado", "Propuesta", "Cerrado", "Perdido"] },
              tags: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
            required: ["contact_id", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_create_contact",
          description: "Propone crear un nuevo contacto.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              last_name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              company: { type: "string" },
              position: { type: "string" },
              summary: { type: "string" },
            },
            required: ["name", "phone", "summary"],
          },
        },
      },
    ];

    const out = await callGateway({ model: "google/gemini-2.5-flash", messages, tools, tool_choice: "auto" });
    if ("error" in out) {
      return new Response(JSON.stringify({ error: out.error }), {
        status: out.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const choice = out.json?.choices?.[0]?.message;
    const text = choice?.content ?? "";
    let actions: any[] = [];
    const proposals: any[] = [];
    const KIND_MAP: Record<string, string> = {
      propose_update_deal_stage: "update_deal_stage",
      propose_update_deal_amount: "update_deal_amount",
      propose_create_task: "create_task",
      propose_create_activity: "create_activity",
      propose_update_contact: "update_contact",
      propose_create_contact: "create_contact",
    };
    for (const tc of choice?.tool_calls ?? []) {
      const name = tc?.function?.name;
      if (!name) continue;
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { continue; }
      if (name === "suggest_actions") {
        if (Array.isArray(args.actions)) actions = args.actions.slice(0, 4);
        continue;
      }
      if (name === "propose_close_deal") {
        const kind = args.outcome === "won" ? "mark_deal_won" : "mark_deal_lost";
        const { summary, outcome: _o, ...payload } = args;
        proposals.push({ id: crypto.randomUUID(), kind, summary: summary ?? "Cerrar deal", payload });
        continue;
      }
      const kind = KIND_MAP[name];
      if (!kind) continue;
      const { summary, ...payload } = args;
      proposals.push({ id: crypto.randomUUID(), kind, summary: summary ?? kind, payload });
    }
    return new Response(JSON.stringify({ text, actions, proposals: proposals.slice(0, 3) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});