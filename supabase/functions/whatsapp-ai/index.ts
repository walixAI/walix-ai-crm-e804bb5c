import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "suggest_reply" | "summarize" | "custom_prompt";

interface Body {
  mode: Mode;
  conversationId: string;
  prompt?: string;
  contactName?: string;
  contactCompany?: string | null;
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

function transcript(messages: any[], limit = 30): string {
  return messages
    .slice(-limit)
    .map((m) => {
      const who = m.is_internal_note ? "[NOTA]" : m.direction === "inbound" ? "Cliente" : "Vendedor";
      return `${who}: ${m.body}`;
    })
    .join("\n");
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
    const { mode, conversationId, prompt, contactName, contactCompany } = body;
    if (!mode || !conversationId) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load last messages of the conversation (RLS scoped to tenant)
    const { data: msgs, error: mErr } = await supabase
      .from("messages")
      .select("direction, body, is_internal_note, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true })
      .limit(80);
    if (mErr) throw mErr;

    const convo = transcript(msgs ?? []);
    const ctxHeader = `Cliente: ${contactName ?? "—"}${contactCompany ? ` (${contactCompany})` : ""}`;

    let payload: Record<string, unknown>;

    if (mode === "suggest_reply") {
      payload = {
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres un vendedor consultivo en español (México). Sugiere UNA respuesta corta (máx 3 frases), cordial, profesional y orientada a avanzar el deal. No incluyas saludos genéricos si ya hubo. No inventes datos. Devuelve solo el texto del mensaje, sin comillas ni explicaciones.",
          },
          { role: "user", content: `${ctxHeader}\n\nConversación:\n${convo}\n\nRedacta la mejor respuesta para enviar ahora al cliente.` },
        ],
      };
    } else if (mode === "summarize") {
      payload = {
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Resumes conversaciones de ventas en español. Devuelve EXACTAMENTE este formato Markdown:\n- 3 a 5 bullets con los puntos clave\n- Línea 'Interés principal: …'\n- Línea 'Objeción detectada: …' (o 'Ninguna')\n- Línea 'Último acuerdo: …' (o 'Sin acuerdo claro')\nSé conciso, sin preámbulos.",
          },
          { role: "user", content: `${ctxHeader}\n\n${convo}` },
        ],
      };
    } else if (mode === "custom_prompt") {
      if (!prompt || !prompt.trim()) {
        return new Response(JSON.stringify({ error: "Prompt vacío" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payload = {
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Asistente de ventas en español. Usa el contexto de la conversación para cumplir la instrucción del usuario. Devuelve solo el texto pedido, sin preámbulos.",
          },
          { role: "user", content: `${ctxHeader}\n\nConversación:\n${convo}\n\nInstrucción: ${prompt}` },
        ],
      };
    } else {
      return new Response(JSON.stringify({ error: "Modo no soportado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = await callGateway(payload);
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
    console.error("whatsapp-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});