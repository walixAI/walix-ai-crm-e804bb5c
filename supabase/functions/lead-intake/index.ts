// Entrada pública de leads (formularios web y API) con atribución y enrolamiento en campañas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { toE164 } from "../_shared/phone.ts";
import { buildAttributionRow, clientIpFrom, type RawAttribution } from "../_shared/attribution.ts";
import { enrollContact } from "../_shared/wa-enroll.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-walix-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const key = req.headers.get("x-walix-key") ?? payload?.key;
  if (!key || typeof key !== "string") return json({ error: "Falta la llave de entrada" }, 401);

  const { data: keyRow } = await sb
    .from("lead_intake_keys")
    .select("tenant_id, is_active")
    .eq("api_key", key)
    .maybeSingle();
  if (!keyRow || !keyRow.is_active) return json({ error: "Llave inválida" }, 401);
  const tenantId = keyRow.tenant_id as string;

  const name = String(payload?.name ?? payload?.full_name ?? "").trim();
  const rawPhone = String(payload?.phone ?? "").trim();
  const email = String(payload?.email ?? "").trim() || null;
  if (!rawPhone && !email) return json({ error: "Se requiere teléfono o correo" }, 400);
  if (name.length > 200 || (email && email.length > 255)) return json({ error: "Datos demasiado largos" }, 400);

  const phone = rawPhone ? toE164(rawPhone) : null;

  const { data: tenant } = await sb.from("tenants").select("track_ip, feature_wa_campaigns").eq("id", tenantId).maybeSingle();

  // Contacto: buscar por teléfono o correo, si no crear
  let contactId: string | null = null;
  if (phone) {
    const { data } = await sb.from("contacts").select("id").eq("tenant_id", tenantId).eq("phone", phone).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId && email) {
    const { data } = await sb.from("contacts").select("id").eq("tenant_id", tenantId).eq("email", email).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  let isNew = false;
  if (!contactId) {
    const { data, error } = await sb.from("contacts").insert({
      tenant_id: tenantId,
      name: name || phone || email,
      phone,
      email,
      source: payload?.source_kind === "meta_ads" ? "Formulario web" : "Formulario web",
      custom_fields: payload?.custom_fields ?? {},
    }).select("id").single();
    if (error) return json({ error: error.message }, 400);
    contactId = data.id;
    isNew = true;
  }

  const raw: RawAttribution = {
    ...(payload?.attribution ?? {}),
    landing_url: payload?.attribution?.landing_url ?? payload?.landing_url ?? null,
    referrer: payload?.attribution?.referrer ?? payload?.referrer ?? null,
    source_kind: payload?.source_kind ?? "web",
    user_agent: payload?.attribution?.user_agent ?? req.headers.get("user-agent"),
    language: payload?.attribution?.language ?? req.headers.get("accept-language")?.split(",")[0] ?? null,
  };

  const ip = clientIpFrom(req);
  const trackIp = tenant?.track_ip !== false;

  const lastRow = await buildAttributionRow(raw, { tenantId, contactId: contactId!, touchType: "last", trackIp, ip });
  await sb.from("contact_attribution").upsert(lastRow, { onConflict: "contact_id,touch_type" });

  const { data: firstExisting } = await sb
    .from("contact_attribution").select("id, touch_count").eq("contact_id", contactId).eq("touch_type", "first").maybeSingle();
  if (!firstExisting) {
    await sb.from("contact_attribution").insert({ ...lastRow, touch_type: "first" });
  } else {
    await sb.from("contact_attribution").update({ touch_count: (firstExisting.touch_count ?? 1) + 1 }).eq("id", firstExisting.id);
  }

  let enrolled: string | null = null;
  if (tenant?.feature_wa_campaigns && phone) {
    enrolled = await enrollContact(sb, tenantId, contactId!);
  }

  return json({ ok: true, contact_id: contactId, created: isNew, enrolled_campaign_id: enrolled });
});
