import { createClient } from "npm:@supabase/supabase-js@2";
import { toE164, phoneMatchVariants } from "../_shared/phone.ts";

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
    const tokenMasked = token ? `${token.slice(0, 4)}…${token.slice(-4)}` : null;
    console.log("webhook GET", { mode, tokenMasked });
    if (mode === "subscribe" && token) {
      // Global verify token (Embedded Signup / app-level webhook)
      const globalToken = Deno.env.get("META_VERIFY_TOKEN");
      if (globalToken && token === globalToken) {
        await sb.from("whatsapp_webhook_log").insert({
          kind: "verify",
          payload: { mode, tokenMasked, match: "global" },
          note: "GET handshake matched META_VERIFY_TOKEN",
        });
        return new Response(challenge ?? "", { status: 200 });
      }
      // Legacy: per-channel verify_token
      const { data } = await sb.from("whatsapp_channels").select("id").eq("verify_token", token).maybeSingle();
      if (data) {
        await sb.from("whatsapp_webhook_log").insert({
          kind: "verify",
          matched_channel_id: data.id,
          payload: { mode, tokenMasked, match: "channel" },
          note: "GET handshake matched per-channel verify_token",
        });
        return new Response(challenge ?? "", { status: 200 });
      }
    }
    await sb.from("whatsapp_webhook_log").insert({
      kind: "verify",
      payload: { mode, tokenMasked, match: "none" },
      note: "GET handshake rejected (token mismatch)",
    });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    await sb.from("whatsapp_webhook_log").insert({
      kind: "unknown",
      note: "POST with invalid JSON body",
    });
    return new Response("bad json", { status: 400 });
  }

  console.log("webhook POST", JSON.stringify(payload).slice(0, 1000));

  try {
    const entries = payload?.entry ?? [];
    if (entries.length === 0) {
      await sb.from("whatsapp_webhook_log").insert({
        kind: "unknown",
        payload,
        note: "POST without entries",
      });
    }
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const hasMessages = Array.isArray(value?.messages) && value.messages.length > 0;
        const hasStatuses = Array.isArray(value?.statuses) && value.statuses.length > 0;
        const kind: "message" | "status" | "unknown" = hasMessages ? "message" : hasStatuses ? "status" : "unknown";

        if (!phoneNumberId) {
          await sb.from("whatsapp_webhook_log").insert({
            kind,
            payload: value ?? change,
            note: "change without phone_number_id",
          });
          continue;
        }

        const { data: channels } = await sb
          .from("whatsapp_channels")
          .select("id, tenant_id, kind, access_token, phone_number_id, connected_at, is_platform")
          .eq("phone_number_id", phoneNumberId);

        if (!channels || channels.length === 0) {
          await sb.from("whatsapp_webhook_log").insert({
            kind,
            phone_number_id: phoneNumberId,
            payload: value,
            note: `No channel registered for phone_number_id=${phoneNumberId}`,
          });
          console.log("webhook no channel match", phoneNumberId);
          continue;
        }

        // Stamp last webhook hit on all matching channels + bitácora (use first as reference)
        const refChannel = channels[0];
        await sb.from("whatsapp_channels").update({
          last_webhook_at: new Date().toISOString(),
          last_webhook_payload: value,
        }).in("id", channels.map((c: any) => c.id));
        await sb.from("whatsapp_webhook_log").insert({
          tenant_id: refChannel.tenant_id,
          matched_channel_id: refChannel.id,
          kind,
          phone_number_id: phoneNumberId,
          payload: value,
          note: hasMessages
            ? `inbound messages: ${value.messages.length} (channels=${channels.length})`
            : hasStatuses
              ? `status updates: ${value.statuses.length}`
              : "change without messages/statuses",
        });

        for (const msg of value?.messages ?? []) {
          const from = String(msg.from ?? "");
          const body = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? "";
          if (!from || !body) continue;

          // Routing: si hay múltiples canales (clients + team con el mismo número),
          // el vendedor autorizado SIEMPRE gana. Si el remitente no está en
          // whatsapp_user_access (o está deshabilitado), cae al canal clients.
          let channel = channels[0];
          if (channels.length > 1) {
            const teamChannel = channels.find((c: any) => c.kind === "team");
            const clientsChannel = channels.find((c: any) => c.kind === "clients");
            let routeToTeam = false;
            if (teamChannel) {
              const variants = phoneMatchVariants(from);
              const { data: vendorAccess } = await sb
                .from("whatsapp_user_access")
                .select("user_id, enabled")
                .eq("tenant_id", teamChannel.tenant_id)
                .in("phone_e164", variants)
                .eq("enabled", true)
                .maybeSingle();
              if (vendorAccess) routeToTeam = true;
            }
            channel = routeToTeam ? teamChannel! : (clientsChannel ?? teamChannel ?? channels[0]);
          }

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

          // Canal global de Walix: el tenant se resuelve por el teléfono del remitente.
          if (channel.is_platform) {
            const variants = phoneMatchVariants(from);
            const { data: access } = await sb
              .from("whatsapp_user_access")
              .select("user_id, enabled, permission_level, tenant_id")
              .in("phone_e164", variants)
              .limit(1)
              .maybeSingle();

            if (!access || !access.enabled) {
              if (channel.access_token) {
                await sendWhatsappText(channel.access_token, channel.phone_number_id, from,
                  "🚫 Este número no está autorizado para usar Walix por WhatsApp. Pide a tu administrador que te dé acceso.");
              }
              continue;
            }

            try {
              const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-ai-command`, {
                method: "POST",
                headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  tenant_id: access.tenant_id,
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
              console.error("platform ai-command invocation failed", e);
              if (channel.access_token) {
                await sendWhatsappText(channel.access_token, channel.phone_number_id, from,
                  "⚠️ Error procesando tu solicitud. Intenta de nuevo.");
              }
            }
            continue;
          }

          if (channel.kind === "clients") {
            // Match contact by any plausible phone format (e164, waId, raw),
            // because Meta sends MX/AR numbers with a legacy mobile prefix.
            const variants = phoneMatchVariants(from);
            const canonical = toE164(from);
            const { data: existing } = await sb
              .from("contacts")
              .select("id, phone")
              .eq("tenant_id", channel.tenant_id)
              .in("phone", variants)
              .limit(1)
              .maybeSingle();
            let contactId = existing?.id;
            if (!contactId) {
              const { data: created } = await sb
                .from("contacts")
                .insert({ tenant_id: channel.tenant_id, phone: canonical, name: canonical, source: "WhatsApp" })
                .select("id")
                .single();
              contactId = created?.id;
            } else if (existing && existing.phone !== canonical) {
              // Heal legacy rows: store canonical going forward.
              await sb.from("contacts").update({ phone: canonical }).eq("id", contactId);
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
                .insert({ tenant_id: channel.tenant_id, contact_id: contactId, channel_id: channel.id, status: "Nuevo", preview: body, last_message_at: new Date().toISOString(), unread_count: 1 })
                .select("id").single();
              convId = c2?.id;
            } else {
              await sb.from("conversations").update({
                preview: body, last_message_at: new Date().toISOString(), channel_id: channel.id,
              }).eq("id", convId);
            }
            if (!convId) continue;

            // Abre (o refresca) la ventana de servicio de 24 h sin costo:
            // un mensaje entrante del cliente inicia una conversación de servicio gratuita.
            await sb.rpc("wa_charge_conversation", {
              _tenant_id: channel.tenant_id,
              _contact_id: contactId,
              _conversation_id: convId,
              _channel_id: channel.id,
              _category: "service",
              _direction: "inbound",
            });

            await sb.from("messages").insert({
              tenant_id: channel.tenant_id,
              conversation_id: convId,
              channel_id: channel.id,
              direction: "inbound",
              body,
              type: "text",
              metadata: { wamid: msg.id },
            });
            // Memoria de IA: doble evento (vista de hilo + contexto del contacto).
            await sb.from("ai_memory_events").insert([
              {
                tenant_id: channel.tenant_id,
                entity_type: "conversation",
                entity_id: convId,
                event_type: "wa_message_received",
                event_data: { from, length: body.length, wamid: msg.id, contact_id: contactId },
              },
              {
                tenant_id: channel.tenant_id,
                entity_type: "contact",
                entity_id: contactId,
                event_type: "wa_message_received",
                event_data: { from, length: body.length, wamid: msg.id, conversation_id: convId },
              },
            ]);

            // Campañas: detener las secuencias activas cuando el contacto responde.
            try {
              const { data: enrolls } = await sb
                .from("wa_enrollments")
                .select("id, campaign_id, wa_campaigns!inner(stop_on_reply)")
                .eq("tenant_id", channel.tenant_id)
                .eq("contact_id", contactId)
                .eq("status", "active");
              const toStop = (enrolls ?? [])
                .filter((e: any) => e.wa_campaigns?.stop_on_reply !== false)
                .map((e: any) => e.id);
              if (toStop.length) {
                await sb.from("wa_enrollments")
                  .update({ status: "stopped", exit_reason: "el contacto respondió", next_send_at: null })
                  .in("id", toStop);
              }
            } catch (e) {
              console.error("stop enrollments failed", e);
            }

          } else if (channel.kind === "team") {
            // Verify user authorization
            const phoneVariants = phoneMatchVariants(from);
            const { data: access } = await sb
              .from("whatsapp_user_access")
              .select("user_id, enabled, permission_level")
              .eq("tenant_id", channel.tenant_id)
              .in("phone_e164", phoneVariants)
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