import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const APP_ID = Deno.env.get("META_APP_ID");
    const APP_SECRET = Deno.env.get("META_APP_SECRET");
    const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN");
    if (!APP_ID || !APP_SECRET || !VERIFY_TOKEN) {
      return json({ error: "meta_secrets_missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supaUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const { code, phone_number_id, waba_id, kind } = body ?? {};
    if (!code || !phone_number_id || !waba_id || !["clients", "team"].includes(kind)) {
      return json({ error: "bad_request", details: "code, phone_number_id, waba_id, kind requeridos" }, 400);
    }

    // Identify user + tenant
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);
    const userId = userData.user.id;

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("active_tenant_id, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile) return json({ error: "profile_not_found" }, 404);
    const tenantId = profile.active_tenant_id ?? profile.tenant_id;
    if (!tenantId) return json({ error: "tenant_not_found" }, 404);

    // Verify admin/owner role
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    const allowed = (roles ?? []).some((r) => ["tenant_owner", "tenant_admin", "org_owner"].includes(r.role));
    if (!allowed) return json({ error: "forbidden", details: "se requiere rol admin/owner" }, 403);

    // 1) Exchange code for business access token
    const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      return json({ error: "token_exchange_failed", meta: tokenJson }, 502);
    }
    const accessToken = tokenJson.access_token as string;

    // 2) Subscribe app to the WABA (so webhooks flow)
    const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const subJson = await subRes.json().catch(() => ({}));
    if (!subRes.ok) {
      return json({ error: "subscribe_app_failed", meta: subJson }, 502);
    }

    // 3) Register the phone number for Cloud API (idempotent)
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const regRes = await fetch(`${GRAPH}/${phone_number_id}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    const regJson = await regRes.json().catch(() => ({}));
    // Allow "already registered" style errors to pass through (subcode 2388009 etc.)
    if (!regRes.ok && regJson?.error?.code !== 133006 && regJson?.error?.code !== 100) {
      console.warn("phone_register_warning", regJson);
    }

    // 4) Fetch phone metadata
    const metaRes = await fetch(`${GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const metaJson = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      return json({ error: "phone_metadata_failed", meta: metaJson }, 502);
    }
    const displayPhone = metaJson?.display_phone_number ?? null;
    const verifiedName = metaJson?.verified_name ?? null;

    // 5) Upsert channel for this tenant + kind
    const { data: existing } = await admin
      .from("whatsapp_channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", kind)
      .maybeSingle();

    const payload = {
      tenant_id: tenantId,
      kind,
      provider: "meta_embedded_signup",
      display_name: verifiedName ?? displayPhone ?? null,
      phone_number: displayPhone,
      phone_number_id,
      business_account_id: waba_id,
      access_token: accessToken,
      verify_token: VERIFY_TOKEN,
      status: "connected" as const,
      connected_at: new Date().toISOString(),
      last_error: null,
    };

    let channelId = existing?.id;
    if (existing) {
      const { error } = await admin.from("whatsapp_channels").update(payload).eq("id", existing.id);
      if (error) return json({ error: "db_update_failed", details: error.message }, 500);
    } else {
      const { data: ins, error } = await admin
        .from("whatsapp_channels")
        .insert(payload)
        .select("id")
        .single();
      if (error) return json({ error: "db_insert_failed", details: error.message }, 500);
      channelId = ins.id;
    }

    // (Hook futuro Solution Partner) — aquí llamaríamos a /extend_credit con cuenta de Walix.

    return json({
      ok: true,
      channel_id: channelId,
      phone_number: displayPhone,
      verified_name: verifiedName,
    }, 200);
  } catch (e) {
    console.error("embedded-signup error", e);
    return json({ error: "internal_error", details: (e as Error).message }, 500);
  }
});