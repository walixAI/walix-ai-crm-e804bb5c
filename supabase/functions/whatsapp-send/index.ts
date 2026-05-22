import { createClient } from "npm:@supabase/supabase-js@2";
import { toWaId } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v20.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json() as {
      conversationId: string;
      body: string;
      internal?: boolean;
    };
    if (!body.conversationId || !body.body?.trim()) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load conversation + contact phone (RLS scopes)
    const { data: conv, error: cErr } = await sb
      .from("conversations")
      .select("id, tenant_id, contact_id, contacts:contact_id(phone)")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (cErr || !conv) {
      return new Response(JSON.stringify({ error: "Conversación no encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sender name for preview prefix (so it muestra en la Bandeja de Entrada y en Contacto)
    const { data: senderProfile } = await sb
      .from("profiles")
      .select("full_name, email")
      .eq("id", userData.user.id)
      .maybeSingle();
    const senderName = (senderProfile?.full_name || senderProfile?.email || "").trim();
    const senderFirst = senderName ? senderName.split(/\s+/)[0] : "";
    const previewWithSender = (txt: string) => (senderFirst ? `${senderFirst}: ${txt}` : txt);

    // Internal note: just store, don't send
    if (body.internal) {
      const { error: insErr } = await sb.from("messages").insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        direction: "outbound",
        body: body.body,
        type: "text",
        is_internal_note: true,
        metadata: { sent_by_user_id: userData.user.id },
      });
      if (insErr) throw insErr;
      await sb.from("conversations").update({ preview: previewWithSender(body.body), last_message_at: new Date().toISOString() }).eq("id", conv.id);
      return new Response(JSON.stringify({ ok: true, internal: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find clients channel for tenant
    const { data: channel } = await sb
      .from("whatsapp_channels")
      .select("id, access_token, phone_number_id, status")
      .eq("tenant_id", conv.tenant_id)
      .eq("kind", "clients")
      .maybeSingle();

    let wamid: string | null = null;
    let providerError: string | null = null;

    if (channel?.status === "connected" && channel.access_token && channel.phone_number_id) {
      const phone = (conv as any).contacts?.phone;
      if (!phone) {
        return new Response(JSON.stringify({ error: "Contacto sin teléfono" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const toNumber = toWaId(phone);
      const res = await fetch(`${META_API}/${channel.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: body.body },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        providerError = json?.error?.message ?? `Meta error ${res.status}`;
      } else {
        wamid = json?.messages?.[0]?.id ?? null;
      }
    }

    const { error: insErr } = await sb.from("messages").insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      channel_id: channel?.id ?? null,
      direction: "outbound",
      body: body.body,
      type: "text",
      metadata: { wamid, provider_error: providerError, simulated: !channel || channel.status !== "connected", sent_by_user_id: userData.user.id },
    });
    if (insErr) throw insErr;
    await sb.from("conversations").update({ preview: previewWithSender(body.body), last_message_at: new Date().toISOString() }).eq("id", conv.id);

    // Memoria de IA: doble evento para mensaje saliente (no para notas internas).
    if (!body.internal && conv.contact_id) {
      await sb.from("ai_memory_events").insert([
        {
          tenant_id: conv.tenant_id,
          entity_type: "conversation",
          entity_id: conv.id,
          event_type: "wa_message_sent",
          event_data: { length: body.body.length, wamid, contact_id: conv.contact_id },
          actor_id: userData.user.id,
        },
        {
          tenant_id: conv.tenant_id,
          entity_type: "contact",
          entity_id: conv.contact_id,
          event_type: "wa_message_sent",
          event_data: { length: body.body.length, wamid, conversation_id: conv.id },
          actor_id: userData.user.id,
        },
      ]);
    }

    if (providerError) {
      return new Response(JSON.stringify({ error: providerError }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, wamid, simulated: !channel || channel.status !== "connected" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});