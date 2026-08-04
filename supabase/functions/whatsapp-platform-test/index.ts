import { createClient } from "npm:@supabase/supabase-js@2";
import { toWaId } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v20.0";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);

    const { data: isPlatform } = await sb.rpc("is_platform", { _user_id: userData.user.id });
    if (!isPlatform) return json({ error: "Solo la plataforma puede usar el número global" }, 403);

    const body = (await req.json().catch(() => ({}))) as { to?: string; text?: string };
    const to = (body.to ?? "").trim();
    if (!to) return json({ error: "Falta el número destino" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: channel } = await admin
      .from("whatsapp_channels")
      .select("id, access_token, phone_number_id, status")
      .eq("is_platform", true)
      .maybeSingle();

    if (!channel?.access_token || !channel.phone_number_id) {
      return json({ error: "El número global aún no está configurado" }, 400);
    }

    const text = body.text?.trim() ||
      "✅ Prueba del número global de Walix. Si recibes este mensaje, la configuración es correcta.";

    const res = await fetch(`${META_API}/${channel.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toWaId(to),
        type: "text",
        text: { body: text },
      }),
    });
    const meta = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = meta?.error?.message ?? `Meta ${res.status}`;
      await admin.from("whatsapp_channels").update({ last_error: message }).eq("id", channel.id);
      return json({ ok: false, error: message }, 502);
    }
    await admin.from("whatsapp_channels")
      .update({ last_error: null, status: "connected", connected_at: channel.status === "connected" ? undefined : new Date().toISOString() })
      .eq("id", channel.id);
    return json({ ok: true, wamid: meta?.messages?.[0]?.id ?? null });
  } catch (e) {
    console.error("whatsapp-platform-test error", e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});