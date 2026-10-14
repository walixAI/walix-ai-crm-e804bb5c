import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  contactId: string;
  outcomeId: string;
}

/** Sugiere la tipificación más probable para un seguimiento según la conversación reciente. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "No autenticado" }, 401);

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    if (!body?.contactId || !body?.outcomeId) return json({ error: "contactId y outcomeId requeridos" }, 400);

    // Catálogo aplicable: del resultado elegido + globales del tenant.
    const { data: typs, error: tErr } = await supabase
      .from("outcome_typifications")
      .select("id, label, sentiment")
      .or(`outcome_id.eq.${body.outcomeId},outcome_id.is.null`)
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (tErr) return json({ error: tErr.message }, 500);
    if (!typs?.length) return json({ typificationId: null });

    // Contexto: últimos mensajes de la conversación del contacto.
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", body.contactId)
      .order("last_message_at", { ascending: false })
      .limit(1);
    let transcript = "";
    if (convs?.length) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("direction, body, created_at")
        .eq("conversation_id", convs[0].id)
        .order("created_at", { ascending: false })
        .limit(12);
      transcript = (msgs ?? [])
        .reverse()
        .map((m: any) => `${m.direction === "inbound" ? "Lead" : "Asesor"}: ${String(m.body ?? "").slice(0, 300)}`)
        .join("\n");
    }
    if (!transcript.trim()) return json({ typificationId: null });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ typificationId: null });

    const catalog = typs.map((t: any) => `- ${t.id}: ${t.label} (${t.sentiment})`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content:
              "Eliges la tipificación que mejor describe la conversación entre un asesor y un lead. " +
              "Responde SOLO con el id exacto de la lista, o con la palabra NINGUNA si ninguna aplica claramente.",
          },
          {
            role: "user",
            content: `Tipificaciones disponibles:\n${catalog}\n\nConversación reciente:\n${transcript}`,
          },
        ],
        max_completion_tokens: 200,
      }),
    });
    if (!res.ok) return json({ typificationId: null });
    const data = await res.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
    const match = typs.find((t: any) => raw.includes(t.id));
    return json({ typificationId: match?.id ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
