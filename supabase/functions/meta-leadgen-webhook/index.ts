// Webhook de formularios nativos de Meta Ads (leadgen) con mapeo configurable a UTMs y campos del contacto.
import { createClient } from "npm:@supabase/supabase-js@2";
import { toE164 } from "../_shared/phone.ts";
import { buildAttributionRow, clientIpFrom, type RawAttribution } from "../_shared/attribution.ts";
import { enrollContact } from "../_shared/wa-enroll.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const META_API = "https://graph.facebook.com/v20.0";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function applyTokens(value: string, ctx: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => ctx[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (req.method === "GET") {
    // Verificación del webhook de Meta
    const challenge = url.searchParams.get("hub.challenge");
    const token = url.searchParams.get("hub.verify_token");
    const expected = Deno.env.get("META_LEADGEN_VERIFY_TOKEN") ?? "walix-leadgen";
    if (token === expected && challenge) return new Response(challenge, { status: 200 });
    return new Response("forbidden", { status: 403 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: true }); }
  console.log("leadgen webhook", JSON.stringify(payload).slice(0, 800));

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const v = change?.value ?? {};
        const leadgenId = v.leadgen_id;
        const formId = String(v.form_id ?? "");
        const pageId = String(v.page_id ?? "");
        if (!leadgenId) continue;

        // Resolver tenant por página/formulario ya mapeado, si no por canal de WhatsApp de la misma cuenta
        let tenantId: string | null = null;
        const { data: mappedForm } = await sb
          .from("meta_form_mappings").select("tenant_id").eq("form_id", formId).maybeSingle();
        tenantId = mappedForm?.tenant_id ?? null;
        if (!tenantId) {
          const { data: anyTenant } = await sb
            .from("tenants").select("id").eq("feature_wa_campaigns", true).limit(1).maybeSingle();
          tenantId = anyTenant?.id ?? null;
        }
        if (!tenantId) continue;

        // Traer el lead desde Meta con el token del canal del tenant
        const { data: channel } = await sb
          .from("whatsapp_channels").select("access_token").eq("tenant_id", tenantId).not("access_token", "is", null).limit(1).maybeSingle();
        let fields: Record<string, string> = {};
        let adCtx: Record<string, string> = {};
        if (channel?.access_token) {
          const res = await fetch(`${META_API}/${leadgenId}?access_token=${channel.access_token}`);
          const lead = await res.json().catch(() => ({}));
          if (!res.ok) console.error("meta lead fetch failed", JSON.stringify(lead).slice(0, 400));
          for (const f of lead?.field_data ?? []) fields[String(f.name)] = String(f.values?.[0] ?? "");
          adCtx = {
            ad_id: lead?.ad_id ?? "", adset_id: lead?.adset_id ?? "", campaign_id: lead?.campaign_id ?? "",
            ad_name: lead?.ad_name ?? "", adset_name: lead?.adset_name ?? "", campaign_name: lead?.campaign_name ?? "",
            form_name: lead?.form_name ?? "", platform: lead?.platform ?? "facebook", page_id: pageId,
          };
        }

        // Mapeo configurado (por formulario o el predeterminado)
        const { data: mapping } = await sb
          .from("meta_form_mappings").select("*").eq("tenant_id", tenantId).eq("form_id", formId).maybeSingle();
        const { data: fallback } = mapping
          ? { data: null }
          : await sb.from("meta_form_mappings").select("*").eq("tenant_id", tenantId).eq("is_default", true).maybeSingle();
        const rule = mapping ?? fallback;

        if (!mapping) {
          // Registrar formulario sin mapear para avisar en pantalla
          await sb.from("meta_form_mappings").upsert({
            tenant_id: tenantId, form_id: formId, form_name: adCtx.form_name || `Formulario ${formId}`,
            leads_count: 1, last_lead_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,form_id" });
        } else {
          await sb.from("meta_form_mappings").update({
            leads_count: (mapping.leads_count ?? 0) + 1, last_lead_at: new Date().toISOString(),
          }).eq("id", mapping.id);
        }

        const fieldMap = (rule?.field_map ?? {}) as Record<string, string>;
        const pick = (target: string, defaults: string[]) => {
          const source = Object.entries(fieldMap).find(([, t]) => t === target)?.[0];
          if (source && fields[source]) return fields[source];
          for (const d of defaults) if (fields[d]) return fields[d];
          return "";
        };
        const name = pick("name", ["full_name", "nombre", "first_name"]).trim();
        const phoneRaw = pick("phone", ["phone_number", "telefono", "phone"]).trim();
        const email = pick("email", ["email", "correo"]).trim() || null;
        const product = pick("product", ["producto", "programa"]).trim() || null;
        if (!phoneRaw && !email) continue;
        const phone = phoneRaw ? toE164(phoneRaw) : null;

        let contactId: string | null = null;
        if (phone) {
          const { data } = await sb.from("contacts").select("id").eq("tenant_id", tenantId).eq("phone", phone).limit(1).maybeSingle();
          contactId = data?.id ?? null;
        }
        if (!contactId && email) {
          const { data } = await sb.from("contacts").select("id").eq("tenant_id", tenantId).eq("email", email).limit(1).maybeSingle();
          contactId = data?.id ?? null;
        }
        if (!contactId) {
          const custom: Record<string, string> = {};
          if (product) custom.producto = product;
          for (const [src, target] of Object.entries(fieldMap)) {
            if (target?.startsWith("custom:") && fields[src]) custom[target.slice(7)] = fields[src];
          }
          const { data, error } = await sb.from("contacts").insert({
            tenant_id: tenantId, name: name || phone || email, phone, email,
            source: "Formulario web", custom_fields: custom,
          }).select("id").single();
          if (error) { console.error("leadgen contact insert", error.message); continue; }
          contactId = data.id;
        }

        const utmMap = (rule?.utm_map ?? {}) as Record<string, string>;
        const raw: RawAttribution = {
          utm_source: applyTokens(utmMap.utm_source ?? "facebook", adCtx),
          utm_medium: applyTokens(utmMap.utm_medium ?? "paid_social", adCtx),
          utm_campaign: applyTokens(utmMap.utm_campaign ?? "{{campaign_name}}", adCtx),
          utm_content: applyTokens(utmMap.utm_content ?? "{{ad_name}}", adCtx),
          utm_term: applyTokens(utmMap.utm_term ?? "{{adset_name}}", adCtx),
          source_kind: "meta_ads",
          meta_ad_id: adCtx.ad_id || null,
          meta_adset_id: adCtx.adset_id || null,
          meta_campaign_id: adCtx.campaign_id || null,
          meta_form_id: formId,
          meta_platform: adCtx.platform || "facebook",
        };

        const { data: tenant } = await sb.from("tenants").select("track_ip, feature_wa_campaigns").eq("id", tenantId).maybeSingle();
        const row = await buildAttributionRow(raw, {
          tenantId, contactId: contactId!, touchType: "last", trackIp: tenant?.track_ip !== false, ip: clientIpFrom(req),
        });
        await sb.from("contact_attribution").upsert(row, { onConflict: "contact_id,touch_type" });
        const { data: first } = await sb
          .from("contact_attribution").select("id, touch_count").eq("contact_id", contactId).eq("touch_type", "first").maybeSingle();
        if (!first) await sb.from("contact_attribution").insert({ ...row, touch_type: "first" });
        else await sb.from("contact_attribution").update({ touch_count: (first.touch_count ?? 1) + 1 }).eq("id", first.id);

        if (tenant?.feature_wa_campaigns && phone) await enrollContact(sb, tenantId, contactId!);
      }
    }
  } catch (e) {
    console.error("leadgen webhook error", e);
  }
  return json({ ok: true });
});
