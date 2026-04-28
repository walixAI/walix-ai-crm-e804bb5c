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
    const [dealsRes, convosRes, contactsRes] = await Promise.all([
      supabase.from("deals")
        .select("id, name, amount, probability, stage_name, is_won, is_lost, last_activity_at, created_at, owner_id")
        .eq("is_won", false).eq("is_lost", false)
        .order("amount", { ascending: false })
        .limit(40),
      supabase.from("conversations")
        .select("id, contact_id, status, unread_count, last_message_preview, last_message_at, assignee_id")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase.from("contacts")
        .select("id, name, company, last_activity_at")
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(30),
    ]);

    const deals = dealsRes.data ?? [];
    const convos = convosRes.data ?? [];
    const contacts = contactsRes.data ?? [];

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
        return `- ${cn?.name ?? "—"} · estado ${c.status ?? "—"} · sin leer ${c.unread_count ?? 0} · "${(c.last_message_preview ?? "").slice(0, 60)}"`;
      }),
    ].join("\n");

    const messages = [
      {
        role: "system",
        content:
          "Eres Walix.ai, el asistente de ventas del usuario en español (México). " +
          "Respondes de forma concisa, accionable y honesta usando ÚNICAMENTE el contexto del CRM proporcionado. " +
          "Si la pregunta no se puede responder con ese contexto, dilo brevemente. " +
          "Formato Markdown: negritas en nombres, listas cortas, montos en MXN. Máx 180 palabras.",
      },
      { role: "system", content: ctx },
      ...(body.history ?? []).slice(-4),
      { role: "user", content: body.prompt },
    ];

    const out = await callGateway({ model: "google/gemini-2.5-flash", messages });
    if ("error" in out) {
      return new Response(JSON.stringify({ error: out.error }), {
        status: out.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = out.json?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});