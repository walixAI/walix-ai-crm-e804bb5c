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

interface PhoneInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
}

interface WabaInfo {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  shared?: boolean;
  phones: PhoneInfo[];
}

interface BusinessNode {
  id: string;
  name: string;
  wabas: WabaInfo[];
}

async function gget(path: string, token: string): Promise<{ ok: boolean; status: number; raw: unknown }> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  let raw: unknown = null;
  try { raw = await r.json(); } catch { /* ignore */ }
  return { ok: r.ok, status: r.status, raw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const APP_ID = (Deno.env.get("META_APP_ID") ?? "").trim();
    const APP_SECRET = (Deno.env.get("META_APP_SECRET") ?? "").trim();
    if (!APP_ID || !APP_SECRET) return json({ error: "meta_secrets_missing" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supaUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "bad_request", details: "token requerido" }, 400);

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

    // 1) Validate token via debug_token
    const appToken = `${APP_ID}|${APP_SECRET}`;
    const dbg = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`,
    );
    const dbgJson = await dbg.json().catch(() => ({}));
    if (!dbg.ok || !dbgJson?.data) {
      return json({ error: "invalid_token", details: "Meta no pudo validar el token", meta: dbgJson }, 400);
    }
    const dbgData = dbgJson.data as {
      is_valid?: boolean;
      scopes?: string[];
      type?: string;
      error?: { message?: string };
    };
    if (!dbgData.is_valid) {
      return json({ error: "invalid_token", details: dbgData.error?.message ?? "Token inválido o expirado" }, 400);
    }
    const scopes = dbgData.scopes ?? [];
    const required = ["whatsapp_business_management", "whatsapp_business_messaging"];
    const missing = required.filter((s) => !scopes.includes(s));
    if (missing.length) {
      return json({ error: "missing_scope", details: `Faltan permisos: ${missing.join(", ")}`, missing, scopes }, 400);
    }

    // 2) List businesses
    const bizRes = await gget("/me/businesses?fields=id,name&limit=100", token);
    if (!bizRes.ok) return json({ error: "businesses_failed", meta: bizRes.raw }, 502);
    const businesses = ((bizRes.raw as { data?: Array<{ id: string; name: string }> })?.data) ?? [];

    const tree: BusinessNode[] = [];
    for (const biz of businesses) {
      const node: BusinessNode = { id: biz.id, name: biz.name, wabas: [] };

      const ownedRes = await gget(
        `/${biz.id}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id&limit=100`,
        token,
      );
      const owned = ((ownedRes.raw as { data?: Array<{ id: string; name?: string; currency?: string; timezone_id?: string }> })?.data) ?? [];

      const clientRes = await gget(
        `/${biz.id}/client_whatsapp_business_accounts?fields=id,name,currency,timezone_id&limit=100`,
        token,
      );
      const clientList = ((clientRes.raw as { data?: Array<{ id: string; name?: string; currency?: string; timezone_id?: string }> })?.data) ?? [];

      const merged = new Map<string, { id: string; name?: string; currency?: string; timezone_id?: string; shared?: boolean }>();
      for (const w of owned) merged.set(w.id, { ...w, shared: false });
      for (const w of clientList) {
        if (!merged.has(w.id)) merged.set(w.id, { ...w, shared: true });
      }

      for (const waba of merged.values()) {
        const phonesRes = await gget(
          `/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status&limit=100`,
          token,
        );
        const phones = ((phonesRes.raw as { data?: PhoneInfo[] })?.data) ?? [];
        node.wabas.push({
          id: waba.id,
          name: waba.name,
          currency: waba.currency,
          timezone_id: waba.timezone_id,
          shared: waba.shared,
          phones,
        });
      }

      tree.push(node);
    }

    const totalWabas = tree.reduce((acc, b) => acc + b.wabas.length, 0);
    const totalPhones = tree.reduce((acc, b) => acc + b.wabas.reduce((a, w) => a + w.phones.length, 0), 0);

    return json({
      ok: true,
      businesses: tree,
      summary: { businesses: tree.length, wabas: totalWabas, phones: totalPhones },
      token_type: dbgData.type,
      scopes,
    }, 200);
  } catch (e) {
    console.error("discover-waba error", e);
    return json({ error: "internal_error", details: (e as Error).message }, 500);
  }
});