import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_API = "https://graph.facebook.com/v20.0";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function sendWhatsappText(token: string, phoneNumberId: string, to: string, body: string) {
  try {
    await fetch(`${META_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
  } catch (e) {
    console.error("sendWhatsappText error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const sb = admin();

  // Meta webhook verification handshake
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token) {
      const { data } = await sb.from("whatsapp_channels").select("id").eq("verify_token", token).maybeSingle();
      if (data) return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  try {
    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: channel } = await sb
          .from("whatsapp_channels")
          .select("id, tenant_id, kind, access_token, phone_number_id, connected_at")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (!channel) continue;

        for (const msg of value?.messages ?? []) {
          const from = String(msg.from ?? "");
          const body = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? "";
          if (!from || !body) continue;

          // Mark live connectivity: record latest inbound; auto-promote to connected if first ever
          {
            const update: Record<string, unknown> = {
              last_inbound_at: new Date().toISOString(),
              last_inbound_from: from,
              last_error: null,
            };
            if (!channel.connected_at) {
              update.connected_at = new Date().toISOString();
              update.status = "connected";
            }
            await sb.from("whatsapp_channels").update(update).eq("id", channel.id);
          }

          if (channel.kind === "clients") {
            // Upsert contact by phone for this tenant
            const { data: existing } = await sb
              .from("contacts")
              .select("id")
              .eq("tenant_id", channel.tenant_id)
              .eq("phone", from)
              .maybeSingle();
            let contactId = existing?.id;
            if (!contactId) {
              const { data: created } = await sb
                .from("contacts")
                .insert({ tenant_id: channel.tenant_id, phone: from, name: from, source: "WhatsApp" })
                .select("id")
                .single();
              contactId = created?.id;
            }
            if (!contactId) continue;

            // Upsert open conversation
            const { data: conv } = await sb
              .from("conversations")
              .select("id")
              .eq("tenant_id", channel.tenant_id)
              .eq("contact_id", contactId)
              .order("last_message_at", { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();
            let convId = conv?.id;
            if (!convId) {
              const { data: c2 } = await sb
                .from("conversations")
                .insert({ tenant_id: channel.tenant_id, contact_id: contactId, status: "Nuevo", preview: body, last_message_at: new Date().toISOString(), unread_count: 1 })
                .select("id").single();
              convId = c2?.id;
            } else {
              await sb.from("conversations").update({
                preview: body, last_message_at: new Date().toISOString(),
              }).eq("id", convId);
            }
            if (!convId) continue;

            await sb.from("messages").insert({
              tenant_id: channel.tenant_id,
              conversation_id: convId,
              channel_id: channel.id,
              direction: "inbound",
              body,
              type: "text",
              metadata: { wamid: msg.id },
            });
          } else if (channel.kind === "team") {
            // Verify user authorization
            const { data: access } = await sb
              .from("whatsapp_user_access")
              .select("user_id, enabled, permission_level")
              .eq("tenant_id", channel.tenant_id)
              .eq("phone_e164", from)
              .maybeSingle();

            if (!access || !access.enabled) {
              if (channel.access_token) {
                await sendWhatsappText(channel.access_token, channel.phone_number_id, from,
                  "🚫 No estás autorizado para usar Walix por WhatsApp. Pide a tu administrador que te habilite.");
              }
              continue;
            }

            // Invoke whatsapp-ai-command
            try {
              const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-ai-command`, {
                method: "POST",
                headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  tenant_id: channel.tenant_id,
                  user_id: access.user_id,
                  permission_level: access.permission_level,
                  prompt: body,
                  from_phone: from,
                  channel_id: channel.id,
                }),
              });
              const aiJson = await aiRes.json().catch(() => ({}));
              const reply = aiJson?.reply ?? "Listo.";
              if (channel.access_token) {
                await sendWhatsappText(channel.access_token, channel.phone_number_id, from, reply);
              }
            } catch (e) {
              console.error("ai-command invocation failed", e);
              if (channel.access_token) {
                await sendWhatsappText(channel.access_token, channel.phone_number_id, from,
                  "⚠️ Error procesando tu solicitud. Intenta de nuevo.");
              }
            }
          }
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});