import { createClient } from "npm:@supabase/supabase-js@2";
import { toWaId } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v20.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "No autenticado" }, 401);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);

    const body = (await req.json().catch(() => ({}))) as { access_id?: string };
    if (!body.access_id) return json({ error: "Falta access_id" }, 400);

    // Cargar registro del vendedor (RLS lo limita al tenant del usuario)
    const { data: access, error: accErr } = await sb
      .from("whatsapp_user_access")
      .select("id, tenant_id, phone_e164, display_name, enabled")
      .eq("id", body.access_id)
      .maybeSingle();
    if (accErr || !access) return json({ error: "Vendedor no encontrado" }, 404);

    // Datos del tenant
    const { data: tenant } = await sb
      .from("tenants")
      .select("name, brand_name")
      .eq("id", access.tenant_id)
      .maybeSingle();
    const tenantName = tenant?.brand_name || tenant?.name || "tu empresa";

    // Canal Equipo propio del tenant; si no existe, el número global de Walix.
    const { data: ownChannel } = await sb
      .from("whatsapp_channels")
      .select("access_token, phone_number_id, status")
      .eq("tenant_id", access.tenant_id)
      .eq("kind", "team")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    let channel = ownChannel as { access_token: string | null; phone_number_id: string | null; status: string } | null;

    if (!channel || channel.status !== "connected" || !channel.access_token || !channel.phone_number_id) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false },
      });
      const { data: platformChannel } = await admin
        .from("whatsapp_channels")
        .select("access_token, phone_number_id, status")
        .eq("is_platform", true)
        .maybeSingle();
      channel = platformChannel as any;
    }

    if (!channel || channel.status !== "connected" || !channel.access_token || !channel.phone_number_id) {
      return json({ ok: false, skipped: true, reason: "team_channel_not_connected" });
    }

    const inviterName = userData.user.user_metadata?.full_name ?? userData.user.email ?? "Tu administrador";
    const greeting = access.display_name?.trim() ? `Hola ${access.display_name.trim()}, ` : "¡Hola! ";

    const message =
      `${greeting}has sido invitado a conversar con el CRM de *${tenantName}* por WhatsApp.\n\n` +
      `Desde este chat podrás:\n` +
      `• Consultar tus contactos y oportunidades\n` +
      `• Crear notas y tareas con un mensaje\n` +
      `• Recibir recordatorios y briefings\n\n` +
      `Para comenzar, responde con *Hola* o pregunta algo como *¿Qué tareas tengo hoy?*\n\n` +
      `Invitado por: ${inviterName}\n\n` +
      `_Mensaje enviado por Walix.ai_`;

    const to = toWaId(access.phone_e164);
    const res = await fetch(`${META_API}/${channel.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });
    const meta = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ ok: false, error: meta?.error?.message ?? `Meta ${res.status}` }, 502);
    }
    return json({ ok: true, wamid: meta?.messages?.[0]?.id ?? null });
  } catch (e) {
    console.error("whatsapp-team-invite error", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}