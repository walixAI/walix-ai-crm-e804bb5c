// Crea plantillas de WhatsApp en la cuenta de Meta del canal del tenant.
// Solo administradores/dueños del tenant o personal de plataforma.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const META_API = "https://graph.facebook.com/v20.0";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "No autenticado" }, 401);
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id ?? "");
    const templates = Array.isArray(body?.templates) ? body.templates.slice(0, 10) : [];
    if (!/^[0-9a-f-]{36}$/.test(tenantId) || !templates.length) return json({ error: "Datos inválidos" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const uid = u.user.id;
    const [{ data: plat }, { data: adm }, { data: own }] = await Promise.all([
      sb.rpc("is_platform", { _user_id: uid }),
      sb.rpc("has_tenant_role", { _user_id: uid, _role: "tenant_admin", _tenant_id: tenantId }),
      sb.rpc("has_tenant_role", { _user_id: uid, _role: "tenant_owner", _tenant_id: tenantId }),
    ]);
    if (!plat && !adm && !own) return json({ error: "Sin permiso" }, 403);

    const { data: ch } = await sb.from("whatsapp_channels")
      .select("id, access_token, business_account_id").eq("tenant_id", tenantId).eq("kind", "clients")
      .neq("status", "disabled").not("business_account_id", "is", null).limit(1).maybeSingle();
    if (!ch?.access_token) return json({ error: "Canal sin token" }, 400);

    const results: unknown[] = [];
    for (const t of templates) {
      const res = await fetch(`${META_API}/${ch.business_account_id}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ch.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const data = await res.json().catch(() => ({}));
      results.push({ name: t?.name, status: res.status, data });
    }
    return json({ ok: true, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
