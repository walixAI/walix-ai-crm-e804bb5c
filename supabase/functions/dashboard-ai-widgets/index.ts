import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function isoWeek(d = new Date()): string {
  // Returns YYYY-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

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

    const body = await req.json().catch(() => ({}));
    const includeReport = body?.includeReport !== false; // default true

    // ---- Gather context (RLS scoped) ----
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
    const tenDaysAgo = new Date(now - 10 * 86400000).toISOString();

    const [dealsRes, convosRes, contactsRes, msgsRes, activitiesRes] = await Promise.all([
      supabase.from("deals")
        .select("id, name, amount, probability, stage_name, is_won, is_lost, last_activity_at:updated_at, created_at, expected_close_date, lost_reason")
        .order("amount", { ascending: false })
        .limit(80),
      supabase.from("conversations")
        .select("id, contact_id, status, unread_count, preview, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(40),
      supabase.from("contacts")
        .select("id, name, last_name, company")
        .limit(60),
      supabase.from("messages")
        .select("id, direction, sent_at")
        .gte("sent_at", sevenDaysAgo)
        .limit(500),
      supabase.from("activities")
        .select("id, type, occurred_at, deal_id, contact_id")
        .gte("occurred_at", sevenDaysAgo)
        .limit(200),
    ]);

    const deals = dealsRes.data ?? [];
    const convos = convosRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const msgs = msgsRes.data ?? [];
    const activities = activitiesRes.data ?? [];

    const active = deals.filter((d: any) => !d.is_won && !d.is_lost);
    const won7d = deals.filter((d: any) => d.is_won && d.last_activity_at >= sevenDaysAgo);
    const lost7d = deals.filter((d: any) => d.is_lost && d.last_activity_at >= sevenDaysAgo);
    const stale = active.filter((d: any) => (d.last_activity_at ?? d.created_at) < tenDaysAgo);
    const totalPipeline = active.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
    const weightedForecast = active.reduce((s: number, d: any) =>
      s + Number(d.amount ?? 0) * (Number(d.probability ?? 0) / 100), 0);
    const inboundMsgs = msgs.filter((m: any) => m.direction === "inbound").length;
    const outboundMsgs = msgs.filter((m: any) => m.direction === "outbound").length;
    const unreadConvos = convos.filter((c: any) => (c.unread_count ?? 0) > 0).length;

    const contactName = (id: string | null) => {
      const c = contacts.find((k: any) => k.id === id);
      return c ? `${c.name} ${c.last_name ?? ""}`.trim() : null;
    };

    const ctx = [
      `# Snapshot del CRM (últimos 7 días)`,
      `- Deals activos: ${active.length}, valor: ${fmtMXN(totalPipeline)}, forecast ponderado: ${fmtMXN(Math.round(weightedForecast))}`,
      `- Deals estancados (>10d sin actividad): ${stale.length}`,
      `- Cerrados ganados 7d: ${won7d.length} (${fmtMXN(won7d.reduce((s, d: any) => s + Number(d.amount ?? 0), 0))})`,
      `- Cerrados perdidos 7d: ${lost7d.length}`,
      `- Mensajes 7d: ${inboundMsgs} entrantes / ${outboundMsgs} salientes`,
      `- Conversaciones sin leer: ${unreadConvos}`,
      ``,
      `## Top 15 deals activos`,
      ...active.slice(0, 15).map((d: any) =>
        `- [${d.id}] ${d.name} · ${fmtMXN(Number(d.amount ?? 0))} · ${d.stage_name ?? "—"} · prob ${d.probability ?? 0}% · últ ${d.last_activity_at}`),
      ``,
      `## Conversaciones recientes con sin leer`,
      ...convos.filter((c: any) => (c.unread_count ?? 0) > 0).slice(0, 8).map((c: any) =>
        `- [${c.id}] ${contactName(c.contact_id) ?? "—"} · ${c.unread_count} sin leer · "${(c.preview ?? "").slice(0, 50)}"`),
    ].join("\n");

    const messages = [
      {
        role: "system",
        content:
          "Eres Walix.ai analyst. Generas widgets de inteligencia para el Dashboard del CRM en español (México). " +
          "Usa SOLO el snapshot proporcionado. Sé concreto, accionable, sin relleno. Montos en MXN. " +
          "SIEMPRE responde llamando la herramienta `render_dashboard` con la estructura completa.",
      },
      { role: "system", content: ctx },
      {
        role: "user",
        content: includeReport
          ? "Genera los 4 widgets del dashboard Y el reporte semanal."
          : "Genera los 4 widgets del dashboard (sin reporte semanal).",
      },
    ];

    const reportProps = includeReport ? {
      weeklyReport: {
        type: "object",
        description: "Reporte ejecutivo de la semana",
        properties: {
          headline: { type: "string", description: "Titular de la semana, máx 80 chars" },
          highlights: { type: "array", maxItems: 4, items: { type: "string", description: "Logro o métrica clave" } },
          concerns: { type: "array", maxItems: 4, items: { type: "string", description: "Riesgo o área a vigilar" } },
          nextWeekFocus: { type: "array", maxItems: 3, items: { type: "string", description: "Acciones prioritarias para la próxima semana" } },
        },
        required: ["headline", "highlights", "concerns", "nextWeekFocus"],
      },
    } : {};

    const tools = [
      {
        type: "function",
        function: {
          name: "render_dashboard",
          description: "Devuelve los widgets del dashboard IA.",
          parameters: {
            type: "object",
            properties: {
              pipelineHealth: {
                type: "object",
                description: "Score 0-100 de salud del pipeline",
                properties: {
                  score: { type: "number", description: "0-100" },
                  status: { type: "string", enum: ["excellent", "good", "warning", "critical"] },
                  summary: { type: "string", description: "1 frase explicando el score, máx 100 chars" },
                  signals: {
                    type: "array", maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Métrica corta" },
                        value: { type: "string", description: "Valor formateado" },
                        tone: { type: "string", enum: ["positive", "neutral", "negative"] },
                      },
                      required: ["label", "value", "tone"],
                    },
                  },
                },
                required: ["score", "status", "summary", "signals"],
              },
              opportunities: {
                type: "array",
                description: "Top 3-5 deals priorizados por urgencia × valor",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    dealId: { type: "string", description: "UUID del deal del catálogo" },
                    name: { type: "string" },
                    amount: { type: "number" },
                    reason: { type: "string", description: "Por qué es prioritario, máx 80 chars" },
                    nextAction: { type: "string", description: "Acción concreta, máx 60 chars" },
                  },
                  required: ["dealId", "name", "amount", "reason", "nextAction"],
                },
              },
              risks: {
                type: "array",
                description: "Riesgos detectados esta semana",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Riesgo en una frase" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                    detail: { type: "string", description: "Contexto, máx 100 chars" },
                    entityType: { type: "string", enum: ["deal", "conversation", "contact", "pipeline"] },
                    entityId: { type: "string", description: "UUID si aplica, opcional" },
                  },
                  required: ["title", "severity", "detail", "entityType"],
                },
              },
              executiveSummary: {
                type: "string",
                description: "Párrafo narrativo (markdown) máx 500 chars: qué pasó, qué hacer hoy, alertas. Puede usar [deal:UUID|Nombre] para citaciones clicables.",
              },
              ...reportProps,
            },
            required: ["pipelineHealth", "opportunities", "risks", "executiveSummary"]
              .concat(includeReport ? ["weeklyReport"] : []),
          },
        },
      },
    ];

    const out = await callGateway({
      model: "google/gemini-2.5-flash",
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "render_dashboard" } },
    });
    if ("error" in out) {
      return new Response(JSON.stringify({ error: out.error }), {
        status: out.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const toolCall = out.json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Respuesta sin estructura" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const widgets = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      ...widgets,
      generatedAt: new Date().toISOString(),
      week: isoWeek(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("dashboard-ai-widgets error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});