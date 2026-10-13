import { createClient } from "npm:@supabase/supabase-js@2";
import { toWaId } from "../_shared/phone.ts";
import { signedDocumentUrl, waMediaPayload, docMessageBody, isImage, type TenantDoc } from "../_shared/tenant-documents.ts";
import { shortDocumentTitle } from "../_shared/document-name.ts";

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
      category?: "service" | "utility" | "marketing" | "authentication";
      template?: { name: string; language?: string; params?: string[] };
      documentId?: string;
    };
    body.body = String(body.body ?? "");
    if (!body.conversationId || (!body.body.trim() && !body.documentId) || (body.documentId && body.internal)) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load conversation + contact phone (RLS scopes)
    const { data: conv, error: cErr } = await sb
      .from("conversations")
      .select("id, tenant_id, contact_id, channel_id, contacts:contact_id(phone)")
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

    // Conversation visibility is validated under caller RLS before resolving credentials server-side.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !serviceUrl) throw new Error("No se pudo resolver el canal de WhatsApp");
    const channelClient = createClient(serviceUrl, serviceKey);
    let channel: { id: string; access_token: string | null; phone_number_id: string | null; status: string } | null = null;
    if ((conv as any).channel_id) {
      const { data } = await channelClient
        .from("whatsapp_channels")
        .select("id, access_token, phone_number_id, status")
        .eq("id", (conv as any).channel_id)
        .eq("tenant_id", conv.tenant_id)
        .maybeSingle();
      channel = data as any;
    }
    if (!(conv as any).channel_id) {
      const { data } = await channelClient
        .from("whatsapp_channels")
        .select("id, access_token, phone_number_id, status, is_default")
        .eq("tenant_id", conv.tenant_id)
        .eq("kind", "clients")
        .eq("status", "connected")
        .eq("is_platform", false)
        .order("is_default", { ascending: false })
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) channel = data as any;
    }

    const jsonRes = (obj: unknown, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!channel || channel.status !== "connected" || !channel.phone_number_id) return jsonRes({ error: "El canal de esta conversación no está conectado" }, 409);
    const isSim = channel.phone_number_id.startsWith("SIM");

    // Documento del tenant: lo valida la RLS del asesor (categoría habilitada) y se envía por enlace firmado.
    let doc: TenantDoc | null = null; let docLink: string | null = null;
    if (body.documentId) {
      const { data: d } = await sb.from("documents").select("id, name, description, storage_path, mime_type")
        .eq("id", body.documentId).eq("tenant_id", conv.tenant_id).maybeSingle();
      if (!d) return jsonRes({ error: "No tienes acceso a ese documento" }, 403);
      doc = { ...d, name: shortDocumentTitle(d.name) } as TenantDoc;
      docLink = await signedDocumentUrl(channelClient, doc.storage_path, 24 * 3600);
      if (!docLink) return jsonRes({ error: "No se pudo preparar el documento" }, 500);
    }
    if (!isSim && !channel.access_token) return jsonRes({ error: "El canal no tiene credenciales de envío disponibles" }, 409);

    // Control de gasto: fuera de la ventana de 24 h solo plantillas, con límites por lead/asesor/empresa.
    const tpl = body.template && typeof body.template.name === "string" && body.template.name.trim()
      ? { name: body.template.name.trim(), language: body.template.language || "es_MX", params: (body.template.params ?? []).map(String) }
      : null;
    let policy: any = null;
    if (conv.contact_id) {
      const { data: pol, error: polErr } = await sb.rpc("wa_template_policy_check", {
        _tenant_id: conv.tenant_id, _contact_id: conv.contact_id, _user_id: userData.user.id, _bot: false,
      });
      if (polErr) {
        console.error("wa_template_policy_check failed", polErr);
        return jsonRes({ error: "No se pudo validar el límite de envíos. Intenta de nuevo en un momento.", code: "policy_failed" }, 503);
      }
      policy = pol;
      if (policy && !policy.window_open && !tpl) {
        return jsonRes({
          error: "Pasaron más de 24 h desde el último mensaje del cliente. Para escribirle, elige una plantilla aprobada.",
          code: "window_closed",
        }, 409);
      }
      if (policy && !policy.window_open && tpl && !policy.allowed) {
        return jsonRes({ error: policy.message ?? "Límite de plantillas alcanzado", code: "spend_limit", next_at: policy.next_at }, 429);
      }
    }
    const isTemplateSend = !!tpl && !!policy && !policy.window_open;

    // Cobro por conversación (ventana de 24 h). Si ya hay ventana abierta no cobra.
    let billing: any = null;
    if (channel?.status === "connected" && conv.contact_id) {
      const { data: charge, error: chargeErr } = await sb.rpc("wa_charge_conversation", {
        _tenant_id: conv.tenant_id,
        _contact_id: conv.contact_id,
        _conversation_id: conv.id,
        _channel_id: channel.id,
        _category: body.category ?? (isTemplateSend ? "marketing" : "service"),
        _direction: "outbound",
      });
      if (chargeErr) {
        console.error("wa_charge_conversation failed", chargeErr);
        return jsonRes({ error: "No se pudo validar el cobro del mensaje. Intenta de nuevo en un momento.", code: "billing_failed" }, 503);
      }
      billing = charge;
      if (billing?.reason === "insufficient_credits") {
        return jsonRes({ error: "Sin créditos de WhatsApp disponibles. Compra un paquete para seguir enviando.", code: "insufficient_credits" }, 402);
      }
    }

    let wamid: string | null = null;
    let providerError: string | null = null;

    if (channel?.status === "connected" && isSim) {
      wamid = `sim.${crypto.randomUUID()}`;
    } else if (channel?.status === "connected" && channel.access_token && channel.phone_number_id) {
      const phone = (conv as any).contacts?.phone;
      if (!phone) {
        if (billing?.charged) await sb.rpc("wa_refund_last_charge", { _tenant_id: conv.tenant_id, _contact_id: conv.contact_id });
        return jsonRes({ error: "Contacto sin teléfono" }, 400);
      }
      const toNumber = toWaId(phone);
      const payload = isTemplateSend && tpl
        ? {
            messaging_product: "whatsapp", to: toNumber, type: "template",
            template: {
              name: tpl.name, language: { code: tpl.language },
              ...(tpl.params.length ? { components: [{ type: "body", parameters: tpl.params.map((t: string) => ({ type: "text", text: t })) }] } : {}),
            },
          }
        : doc && docLink
          ? waMediaPayload(toNumber, doc, docLink, body.body.trim() || undefined)
          : { messaging_product: "whatsapp", to: toNumber, type: "text", text: { body: body.body } };
      const res = await fetch(`${META_API}/${channel.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        providerError = json?.error?.message ?? `Meta error ${res.status}`;
      } else {
        wamid = json?.messages?.[0]?.id ?? null;
      }
    }

    // Si Meta rechazó el mensaje, devolvemos el crédito cobrado.
    if (providerError && billing?.charged && conv.contact_id) {
      const { error: refErr } = await sb.rpc("wa_refund_last_charge", { _tenant_id: conv.tenant_id, _contact_id: conv.contact_id });
      if (refErr) console.error("refund failed", refErr);
      else billing = { ...billing, refunded: true };
    }

    const { error: insErr } = await sb.from("messages").insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      channel_id: channel?.id ?? null,
      direction: "outbound",
      body: doc && !isTemplateSend ? docMessageBody(doc, body.body.trim() || undefined) : body.body,
      type: doc && !isTemplateSend ? (isImage(doc.mime_type) ? "image" : "document") : "text",
      metadata: {
        wamid, provider_error: providerError, simulated: !channel || channel.status !== "connected" || isSim,
        sent_by_user_id: userData.user.id, billing,
        ...(isTemplateSend && tpl ? { kind: "template", template_name: tpl.name, policy_bypass: !!policy?.bypass, attempt: policy?.attempt } : {}),
        ...(doc && !isTemplateSend ? { document_id: doc.id, document_name: doc.name, mime_type: doc.mime_type } : {}),
      },
    });
    if (insErr) throw insErr;
    const previewText = doc && !isTemplateSend ? `📎 ${doc.name}` : body.body;
    await sb.from("conversations").update({ preview: previewWithSender(previewText), last_message_at: new Date().toISOString(), ...(channel ? { channel_id: channel.id } : {}) }).eq("id", conv.id);

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
    return new Response(JSON.stringify({ ok: true, wamid, simulated: !channel || channel.status !== "connected", billing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});