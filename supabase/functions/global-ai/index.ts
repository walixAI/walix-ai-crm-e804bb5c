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
  context?: {
    route?: string;
    entityType?: "deal" | "contact" | "convo";
    entityId?: string;
    entityLabel?: string;
  } | null;
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

    // ---- Page context: enrich prompt if user is viewing a specific entity ----
    let pageContextBlock = "";
    const ctxIn = body.context;
    if (ctxIn?.entityType && ctxIn?.entityId) {
      try {
        if (ctxIn.entityType === "deal") {
          const { data: d } = await supabase.from("deals")
            .select("id, name, amount, probability, stage_name, last_activity_at, is_won, is_lost")
            .eq("id", ctxIn.entityId).maybeSingle();
          if (d) {
            pageContextBlock = `## Contexto de la página actual\nEl usuario está viendo el deal **${d.name}** (id: ${d.id}).\n  · Etapa: ${d.stage_name ?? "—"} · Monto: ${fmtMXN(Number(d.amount ?? 0))} · Prob: ${d.probability ?? 0}%\n  · Estado: ${d.is_won ? "Ganado" : d.is_lost ? "Perdido" : "Abierto"} · Última actividad: ${d.last_activity_at ?? "—"}\nSi el usuario usa pronombres ("súbele", "muévelo", "ciérralo"), asume que se refiere a este deal.`;
            if (!deals.find((x: any) => x.id === d.id)) deals.unshift(d as any);
          }
        } else if (ctxIn.entityType === "contact") {
          const { data: c } = await supabase.from("contacts")
            .select("id, name, last_name, company, phone, email, status")
            .eq("id", ctxIn.entityId).maybeSingle();
          if (c) {
            pageContextBlock = `## Contexto de la página actual\nEl usuario está viendo el contacto **${c.name} ${c.last_name ?? ""}** (id: ${c.id}).\n  · Empresa: ${c.company ?? "—"} · Tel: ${c.phone ?? "—"} · Estado: ${c.status ?? "—"}\nSi el usuario usa pronombres ("actualízalo", "agrégale tag"), asume que se refiere a este contacto.`;
            if (!contacts.find((x: any) => x.id === c.id)) contacts.unshift(c as any);
          }
        } else if (ctxIn.entityType === "convo") {
          const { data: cv } = await supabase.from("conversations")
            .select("id, status, unread_count, preview, contact_id").eq("id", ctxIn.entityId).maybeSingle();
          if (cv) {
            const cn = contacts.find((k: any) => k.id === cv.contact_id);
            pageContextBlock = `## Contexto de la página actual\nEl usuario está viendo la conversación con **${cn?.name ?? "—"}** (id: ${cv.id}).\n  · Estado: ${cv.status ?? "—"} · Sin leer: ${cv.unread_count ?? 0} · Último: "${(cv.preview ?? "").slice(0, 80)}"`;
          }
        }
      } catch (e) { console.warn("page context fetch failed", e); }
    }

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
          "Puedes proponer hasta 3 cambios por turno. Usa SOLO IDs presentes en los catálogos.\n\n" +
          "BÚSQUEDA: si el usuario menciona un deal o contacto que NO aparece en los catálogos, NO inventes el ID. " +
          "Llama primero a `search_entity` con el nombre/teléfono/email parcial. Si hay múltiples resultados, " +
          "pide al usuario que aclare cuál antes de proponer.\n\n" +
          "REGLA DE CREAR DEALS: cuando el usuario pida 'crea/agrega/registra deal de $X (asociado a) <persona>': " +
          "1) Si <persona> aparece en el catálogo de contactos o en el resultado de search_entity con un único match claro, " +
          "usa ese contact_id. 2) Si NO hay match, propón el deal SIN contact_id (deja el campo vacío) y menciona en " +
          "`reasoning` que conviene crear/vincular un contacto después. NUNCA pidas datos como teléfono/email para crear " +
          "el deal: el deal puede existir sin contacto. El nombre del deal puede inferirse: 'Deal <persona>' si no lo dice. " +
          "La etapa se asigna automáticamente a la primera del pipeline si no la especificas.\n\n" +
          "REGLA DE VINCULAR CONTACTO: si el usuario pide 'vincula/asocia el deal X al contacto Y' o se refiere a un deal " +
          "ya existente para asociarle un contacto, usa `propose_link_contact_to_deal` (NO `propose_update_deal_amount`).\n\n" +
          "REGLA DE MÚLTIPLES CANDIDATOS: cuando `search_entity` devuelva 2 o más resultados ambiguos, NO inventes ni " +
          "elijas uno al azar. En su lugar: 1) Llama a `present_candidates` con la lista (kind, intent que describa qué " +
          "vas a hacer cuando el usuario elija — ej: 'crear_deal', 'vincular_contacto'), y los candidatos. 2) En el texto, " +
          "di brevemente '¿A cuál te refieres?'. NO emitas propuestas (`propose_*`) en ese turno. El usuario seleccionará " +
          "y en el siguiente turno podrás continuar con la propuesta correcta.\n\n" +
          "EXPLICACIÓN: cada `propose_*` incluye un campo `reasoning` (máx 200 chars) con 1-2 frases sobre qué " +
          "datos del contexto motivaron la propuesta (etapa, días sin actividad, monto, conversación, etc.). " +
          "El usuario podrá editar la propuesta antes de confirmar; si no estás 100% seguro de un valor, " +
          "propón el más razonable y mencionalo en el reasoning.",
      },
      { role: "system", content: ctx },
      ...(pageContextBlock ? [{ role: "system", content: pageContextBlock }] : []),
      {
        role: "system",
        content:
          "Catálogo de IDs válidos (usa SOLO estos):\n" +
          `Deals: ${JSON.stringify(dealCatalog)}\n` +
          `Conversaciones: ${JSON.stringify(convoCatalog)}\n` +
          `Contactos: ${JSON.stringify(contactCatalog)}\n` +
          `Etapas de pipeline: ${JSON.stringify(stageCatalog)}`,
      },
      ...(body.history ?? []).slice(-6),
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
          name: "search_entity",
          description: "Busca un deal, contacto o conversación por nombre/teléfono/email parcial cuando NO está en los catálogos. Devuelve hasta 5 candidatos con sus IDs.",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["deal", "contact", "convo"] },
              query: { type: "string", description: "Texto parcial: nombre, teléfono o email" },
            },
            required: ["kind", "query"],
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
              reasoning: { type: "string", description: "1-2 frases sobre qué datos motivan esta propuesta (máx 200 chars)" },
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
              reasoning: { type: "string" },
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
              reasoning: { type: "string" },
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
              reasoning: { type: "string" },
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
              reasoning: { type: "string" },
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
              reasoning: { type: "string" },
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
              reasoning: { type: "string" },
            },
            required: ["name", "phone", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_create_deal",
          description: "Propone crear un nuevo deal/oportunidad. Puede vincularse a un contacto existente (contact_id) o quedar sin contacto.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre del deal. Si el usuario no lo da, usa 'Deal <persona>' o 'Oportunidad <empresa>'." },
              amount: { type: "number", minimum: 1, description: "Monto en MXN." },
              contact_id: { type: "string", description: "UUID del contacto (catálogo Contactos o resultado de search_entity). Omitir si no hay match." },
              contact_name: { type: "string", description: "Nombre del contacto para mostrar en el resumen, aunque contact_id esté vacío." },
              stage_id: { type: "string", description: "UUID de etapa (catálogo Etapas). Omitir para usar la primera por defecto." },
              probability: { type: "number", minimum: 0, maximum: 100 },
              expected_close_date: { type: "string", description: "ISO date (YYYY-MM-DD). Opcional." },
              summary: { type: "string", description: "Resumen humano: 'Crear deal **Acme** por $50,000'." },
              reasoning: { type: "string" },
            },
            required: ["name", "amount", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_link_contact_to_deal",
          description: "Propone vincular un contacto existente a un deal existente. Usar cuando el deal ya existe y solo falta asociarle el contacto.",
          parameters: {
            type: "object",
            properties: {
              deal_id: { type: "string", description: "UUID del deal (catálogo Deals)" },
              contact_id: { type: "string", description: "UUID del contacto (catálogo Contactos o resultado de search_entity)" },
              summary: { type: "string", description: "Resumen humano: 'Vincular **Juan Pérez** al deal **Acme Corp**'" },
              reasoning: { type: "string" },
            },
            required: ["deal_id", "contact_id", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "present_candidates",
          description: "Cuando search_entity devuelve múltiples resultados ambiguos, presenta los candidatos al usuario para que elija. NO emitas propose_* en el mismo turno.",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["deal", "contact", "convo"] },
              intent: { type: "string", description: "Qué se hará cuando el usuario elija. Ej: 'crear_deal_de_50000', 'vincular_al_deal_acme', 'abrir'" },
              candidates: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "UUID del candidato" },
                    name: { type: "string", description: "Nombre principal" },
                    subtitle: { type: "string", description: "Detalle (empresa, teléfono, etapa, etc.)" },
                  },
                  required: ["id", "name"],
                },
              },
            },
            required: ["kind", "intent", "candidates"],
          },
        },
      },
    ];

    // ─── Multi-turn loop to support search_entity ───
    const convoMessages: any[] = [...messages];
    let choice: any = null;
    let actions: any[] = [];
    const proposals: any[] = [];
    const MAX_TURNS = 3;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const out = await callGateway({ model: "google/gemini-2.5-flash", messages: convoMessages, tools, tool_choice: "auto" });
      if ("error" in out) {
        return new Response(JSON.stringify({ error: out.error }), {
          status: out.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      choice = out.json?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls ?? [];

      // Check if model invoked search_entity → resolve and loop
      const searches = toolCalls.filter((tc: any) => tc?.function?.name === "search_entity");
      if (searches.length > 0) {
        convoMessages.push({
          role: "assistant",
          content: choice.content ?? "",
          tool_calls: toolCalls,
        });
        for (const tc of toolCalls) {
          if (tc?.function?.name !== "search_entity") {
            // ignore other calls in this turn — re-emit will happen naturally
            convoMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ ignored: true }) });
            continue;
          }
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch {}
          const q = String(args.query ?? "").trim();
          let results: any[] = [];
          if (q.length >= 2) {
            const like = `%${q}%`;
            if (args.kind === "deal") {
              const { data } = await supabase.from("deals")
                .select("id, name, stage_name, amount").ilike("name", like).limit(5);
              results = data ?? [];
            } else if (args.kind === "contact") {
              const { data } = await supabase.from("contacts")
                .select("id, name, last_name, company, phone, email")
                .or(`name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
                .limit(5);
              results = data ?? [];
            } else if (args.kind === "convo") {
              const { data: cMatches } = await supabase.from("contacts")
                .select("id, name").ilike("name", like).limit(10);
              const ids = (cMatches ?? []).map((c: any) => c.id);
              if (ids.length) {
                const { data: cv } = await supabase.from("conversations")
                  .select("id, contact_id, status, preview").in("contact_id", ids).limit(5);
                results = (cv ?? []).map((c: any) => ({
                  ...c,
                  contact_name: cMatches?.find((m: any) => m.id === c.contact_id)?.name,
                }));
              }
            }
          }
          convoMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ kind: args.kind, query: q, results }),
          });
        }
        continue; // next turn
      }

      // No search → process final proposals/actions and break
      break;
    }

    const text = choice?.content ?? "";
    const KIND_MAP: Record<string, string> = {
      propose_update_deal_stage: "update_deal_stage",
      propose_update_deal_amount: "update_deal_amount",
      propose_create_task: "create_task",
      propose_create_activity: "create_activity",
      propose_update_contact: "update_contact",
      propose_create_contact: "create_contact",
      propose_create_deal: "create_deal",
      propose_link_contact_to_deal: "link_contact_to_deal",
    };
    let candidates: any = null;
    for (const tc of choice?.tool_calls ?? []) {
      const name = tc?.function?.name;
      if (!name) continue;
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { continue; }
      if (name === "suggest_actions") {
        if (Array.isArray(args.actions)) actions = args.actions.slice(0, 4);
        continue;
      }
      if (name === "search_entity") continue; // handled in loop
      if (name === "present_candidates") {
        if (Array.isArray(args.candidates) && args.candidates.length >= 2) {
          candidates = {
            kind: args.kind,
            intent: typeof args.intent === "string" ? args.intent.slice(0, 200) : "",
            items: args.candidates.slice(0, 5).map((c: any) => ({
              id: String(c.id ?? ""),
              name: String(c.name ?? ""),
              subtitle: typeof c.subtitle === "string" ? c.subtitle.slice(0, 120) : undefined,
            })).filter((c: any) => c.id && c.name),
          };
        }
        continue;
      }
      if (name === "propose_close_deal") {
        const kind = args.outcome === "won" ? "mark_deal_won" : "mark_deal_lost";
        const { summary, reasoning, outcome: _o, ...payload } = args;
        proposals.push({
          id: crypto.randomUUID(),
          kind,
          summary: summary ?? "Cerrar deal",
          reasoning: typeof reasoning === "string" ? reasoning.slice(0, 300) : undefined,
          payload,
        });
        continue;
      }
      const kind = KIND_MAP[name];
      if (!kind) continue;
      const { summary, reasoning, ...payload } = args;
      proposals.push({
        id: crypto.randomUUID(),
        kind,
        summary: summary ?? kind,
        reasoning: typeof reasoning === "string" ? reasoning.slice(0, 300) : undefined,
        payload,
      });
    }
    let finalText = text;
    if (!finalText && candidates && candidates.items?.length) {
      finalText = "¿A cuál te refieres?";
    }
    if (!finalText && proposals.length > 0) {
      finalText = proposals.length === 1
        ? "Preparé este cambio para que lo confirmes:"
        : `Preparé ${proposals.length} cambios para que los confirmes:`;
    }
    if (!finalText && actions.length > 0) {
      finalText = "Aquí tienes accesos directos relacionados:";
    }
    if (!finalText) {
      finalText = "No tengo información suficiente para responder con los datos actuales del CRM.";
    }
    return new Response(JSON.stringify({ text: finalText, actions, proposals: proposals.slice(0, 3), candidates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});