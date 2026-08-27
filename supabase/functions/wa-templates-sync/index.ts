// Sincroniza las plantillas aprobadas de Meta hacia wa_templates por tenant/canal.
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
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "No autenticado" }, 401);
    const { data: profile } = await userClient.from("profiles").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return json({ error: "Sin empresa asignada" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: channels } = await sb
      .from("whatsapp_channels")
      .select("id, access_token, business_account_id, phone_number_id")
      .eq("tenant_id", tenantId)
      .neq("status", "disabled");

    let synced = 0;
    const errors: string[] = [];

    for (const ch of channels ?? []) {
      if (!ch.access_token || !ch.business_account_id) { errors.push("Canal sin cuenta de WhatsApp Business o token"); continue; }
      const url = `${META_API}/${ch.business_account_id}/message_templates?limit=200&access_token=${ch.access_token}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("template sync failed", res.status, JSON.stringify(data).slice(0, 400));
        errors.push(data?.error?.message ?? `HTTP ${res.status}`);
        continue;
      }
      for (const t of data?.data ?? []) {
        const bodyComp = (t.components ?? []).find((c: any) => c.type === "BODY");
        const bodyText: string = bodyComp?.text ?? "";
        const varCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;
        const { error } = await sb.from("wa_templates").upsert({
          tenant_id: tenantId,
          channel_id: ch.id,
          name: t.name,
          language: t.language,
          category: t.category ?? null,
          status: String(t.status ?? "").toLowerCase(),
          body_text: bodyText,
          variables: Array.from({ length: varCount }, (_, i) => `{{${i + 1}}}`),
          components: t.components ?? [],
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,name,language" });
        if (error) errors.push(error.message);
        else synced++;
      }
    }

    return json({ ok: true, synced, errors });
  } catch (e) {
    console.error("templates sync error", e);
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
