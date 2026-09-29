// Aceptar, autorizar fuente o descartar un lead rechazado por las fuentes de ingreso.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);

  let body: any; try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const id = String(body?.id ?? ""); const action = String(body?.action ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["accept", "authorize", "dismiss"].includes(action)) return json({ error: "Datos inválidos" }, 400);

  // RLS garantiza que el lead sea de la empresa del usuario
  const { data: row } = await userClient.from("rejected_leads").select("*").eq("id", id).maybeSingle();
  if (!row) return json({ error: "Lead no encontrado" }, 404);
  if (row.status !== "pending") return json({ error: "Este lead ya fue atendido" }, 409);

  const sb = createClient(url, service);
  const resolve = (status: string, contactId: string | null = null) =>
    sb.from("rejected_leads").update({ status, contact_id: contactId, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", id);

  if (action === "dismiss") { await resolve("dismissed"); return json({ ok: true }); }

  if (action === "authorize" && row.rule_kind && row.rule_value) {
    const { error } = await sb.from("lead_source_rules").insert({ tenant_id: row.tenant_id, kind: row.rule_kind, value: row.rule_value });
    if (error && error.code === "23505") {
      const { data: existing } = await sb.from("lead_source_rules").select("tenant_id").eq("kind", row.rule_kind).eq("value", row.rule_value).maybeSingle();
      if (existing?.tenant_id !== row.tenant_id) return json({ error: "Esta fuente ya está registrada en otra empresa" }, 409);
    } else if (error) return json({ error: error.message }, 400);
  }

  const { data: keyRow } = await sb.from("lead_intake_keys").select("api_key").eq("tenant_id", row.tenant_id).eq("is_active", true).limit(1).maybeSingle();
  if (!keyRow) return json({ error: "La empresa no tiene una llave de entrada activa" }, 400);

  const res = await fetch(`${url}/functions/v1/lead-intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}`, "x-walix-key": keyRow.api_key },
    body: JSON.stringify({ ...(row.payload ?? {}), _bypass_rules: true }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: out?.error ?? "No se pudo aceptar el lead" }, 400);

  // Aceptar también los demás pendientes de la misma fuente al autorizarla
  await resolve("accepted", out.contact_id ?? null);
  return json({ ok: true, contact_id: out.contact_id, deal_id: out.deal_id });
});
