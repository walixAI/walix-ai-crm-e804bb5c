import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supaUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const channelId = body?.channel_id;
    if (!channelId || typeof channelId !== "string") return json({ error: "channel_id requerido" }, 400);

    // RLS-protected read ensures the caller is admin/owner of the tenant
    const { data: ch, error: chErr } = await supaUser
      .from("whatsapp_channels")
      .select("id, phone_number_id, access_token")
      .eq("id", channelId)
      .maybeSingle();
    if (chErr) return json({ error: chErr.message }, 403);
    if (!ch) return json({ error: "canal no encontrado o sin permisos" }, 404);
    if (!ch.phone_number_id || !ch.access_token) return json({ error: "credenciales incompletas" }, 400);

    const metaUrl = `https://graph.facebook.com/v21.0/${ch.phone_number_id}?fields=verified_name,display_phone_number`;
    const r = await fetch(metaUrl, { headers: { Authorization: `Bearer ${ch.access_token}` } });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg = data?.error?.message ?? `HTTP ${r.status}`;
      await admin.from("whatsapp_channels").update({
        status: "error", last_error: msg,
      }).eq("id", ch.id);
      return json({ ok: false, status: "error", last_error: msg }, 200);
    }

    await admin.from("whatsapp_channels").update({
      status: "connected",
      connected_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", ch.id);

    return json({ ok: true, status: "connected", meta_info: data }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}