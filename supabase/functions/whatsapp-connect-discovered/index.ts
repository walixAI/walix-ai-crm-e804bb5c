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
    const VERIFY_TOKEN = (Deno.env.get("META_VERIFY_TOKEN") ?? "").trim();
    if (!VERIFY_TOKEN) return json({ error: "meta_secrets_missing", details: "META_VERIFY_TOKEN" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supaUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const waba_id = typeof body?.waba_id === "string" ? body.waba_id.trim() : "";
    const phone_number_id = typeof body?.phone_number_id === "string" ? body.phone_number_id.trim() : "";
    const kind = body?.kind;
    if (!token || !waba_id || !phone_number_id || !["clients", "team"].includes(kind)) {
      return json({ error: "bad_request", details: "token, waba_id, phone_number_id, kind requeridos" }, 400);
    }

    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("active_tenant_id, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    const tenantId = profile?.active_tenant_id ?? profile?.tenant_id;
    if (!tenantId) return json({ error: "tenant_not_found" }, 404);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    const allowed = (roles ?? []).some((r) => ["tenant_owner", "tenant_admin", "org_owner"].includes(r.role));
    if (!allowed) return json({ error: "forbidden", details: "se requiere rol admin/owner" }, 403);

    const steps: Record<string, { ok: boolean; detail?: string }> = {};

    // 1) Subscribe app to WABA (so webhooks flow)
    try {
      const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const subJson = await subRes.json().catch(() => ({}));
      if (!subRes.ok) {
        return json({ error: "subscribe_app_failed", meta: subJson, steps }, 502);
      }
      steps.subscribed_apps = { ok: true };
    } catch (e) {
      return json({ error: "subscribe_app_failed", details: (e as Error).message }, 502);
    }

    // 2) Register the phone (best-effort, idempotent)
    try {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      const regRes = await fetch(`${GRAPH}/${phone_number_id}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      });
      const regJson = await regRes.json().catch(() => ({}));
      if (regRes.ok) {
        steps.register = { ok: true };
      } else {
        const code = regJson?.error?.code;
        const sub = regJson?.error?.error_subcode;
        // 133006/133005 (already registered) etc — keep going
        steps.register = { ok: false, detail: `code=${code} subcode=${sub} ${regJson?.error?.message ?? ""}` };
      }
    } catch (e) {
      steps.register = { ok: false, detail: (e as Error).message };
    }

    // 3) Fetch phone metadata
    let displayPhone: string | null = null;
    let verifiedName: string | null = null;
    try {
      const metaRes = await fetch(`${GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      if (!metaRes.ok) {
        return json({ error: "phone_metadata_failed", meta: metaJson, steps }, 502);
      }
      displayPhone = metaJson?.display_phone_number ?? null;
      verifiedName = metaJson?.verified_name ?? null;
      steps.metadata = { ok: true };
    } catch (e) {
      return json({ error: "phone_metadata_failed", details: (e as Error).message, steps }, 502);
    }

    // 4) Send hello_world template test (best-effort)
    let testSent = false;
    try {
      if (displayPhone) {
        const to = displayPhone.replace(/[^\d]/g, "");
        const msgRes = await fetch(`${GRAPH}/${phone_number_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: { name: "hello_world", language: { code: "en_US" } },
          }),
        });
        const msgJson = await msgRes.json().catch(() => ({}));
        if (msgRes.ok) {
          testSent = true;
          steps.test_message = { ok: true };
        } else {
          steps.test_message = { ok: false, detail: msgJson?.error?.message ?? `status ${msgRes.status}` };
        }
      }
    } catch (e) {
      steps.test_message = { ok: false, detail: (e as Error).message };
    }

    // 5) Upsert channel
    const { data: existing } = await admin
      .from("whatsapp_channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", kind)
      .maybeSingle();

    const payload = {
      tenant_id: tenantId,
      kind,
      provider: "byo_waba_discovery",
      display_name: verifiedName ?? displayPhone ?? null,
      phone_number: displayPhone,
      phone_number_id,
      business_account_id: waba_id,
      access_token: token,
      verify_token: VERIFY_TOKEN,
      status: "connected" as const,
      connected_at: new Date().toISOString(),
      last_error: null,
    };

    let channelId = existing?.id;
    if (existing) {
      const { error } = await admin.from("whatsapp_channels").update(payload).eq("id", existing.id);
      if (error) return json({ error: "db_update_failed", details: error.message, steps }, 500);
    } else {
      const { data: ins, error } = await admin
        .from("whatsapp_channels")
        .insert(payload)
        .select("id")
        .single();
      if (error) return json({ error: "db_insert_failed", details: error.message, steps }, 500);
      channelId = ins.id;
    }
    steps.saved = { ok: true };

    return json({
      ok: true,
      channel_id: channelId,
      phone_number: displayPhone,
      verified_name: verifiedName,
      test_message_sent: testSent,
      steps,
    }, 200);
  } catch (e) {
    console.error("connect-discovered error", e);
    return json({ error: "internal_error", details: (e as Error).message }, 500);
  }
});