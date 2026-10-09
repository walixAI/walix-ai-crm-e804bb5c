// Público: baja de correos masivos (enlace firmado) y webhooks de proveedores (rebotes/quejas/aperturas).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { hmacToken, json } from "../_shared/email.ts";

const j = (b: unknown, s = 200) => json(corsHeaders, b, s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  try {
    // Webhook: /email-public?hook=<provider>&t=<tenant>&s=<firma>
    const hook = url.searchParams.get("hook");
    if (hook) {
      const t = url.searchParams.get("t") ?? "";
      if (url.searchParams.get("s") !== await hmacToken(`hook|${t}`)) return j({ error: "firma" }, 401);
      const ct = req.headers.get("content-type") ?? "";
      let raw: any = ct.includes("json") ? await req.json() : Object.fromEntries((await req.formData()).entries());
      if (hook === "mandrill" && raw.mandrill_events) raw = JSON.parse(raw.mandrill_events);
      const events: any[] = Array.isArray(raw) ? raw : [raw];
      for (const ev of events) {
        const d = ev["event-data"] ?? ev.msg ?? ev;
        const email = String(d.email ?? d.recipient ?? ev.email ?? "").toLowerCase();
        const kind = String(ev.event ?? d.event ?? ev.eventType ?? "").toLowerCase();
        if (!email) continue;
        const bounce = /bounce|hard_bounce|dropped|failed|spam|complain|unsubscrib/.test(kind);
        if (bounce) await sb.from("email_suppressions").upsert({ tenant_id: t, email, reason: kind }, { onConflict: "tenant_id,email", ignoreDuplicates: true });
        const patch: any = {};
        if (/open/.test(kind)) patch.opened_at = new Date().toISOString();
        if (/click/.test(kind)) patch.clicked_at = new Date().toISOString();
        if (/deliver/.test(kind)) patch.status = "delivered";
        if (bounce) patch.status = /spam|complain/.test(kind) ? "complained" : /unsub/.test(kind) ? "unsubscribed" : "bounced";
        if (Object.keys(patch).length) await sb.from("email_campaign_recipients").update(patch).eq("tenant_id", t).eq("email", email).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
      }
      return j({ ok: true });
    }

    // Baja
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const t = body.t ?? url.searchParams.get("t");
    const e = String(body.e ?? url.searchParams.get("e") ?? "").toLowerCase();
    const s = body.s ?? url.searchParams.get("s");
    if (!t || !e || s !== await hmacToken(`${t}|${e}`)) return j({ error: "Enlace no válido" }, 400);
    await sb.from("email_suppressions").upsert({ tenant_id: t, email: e, reason: "unsubscribe" }, { onConflict: "tenant_id,email", ignoreDuplicates: true });
    await sb.from("email_campaign_recipients").update({ status: "unsubscribed" }).eq("tenant_id", t).eq("email", e).eq("status", "sent");
    return j({ ok: true });
  } catch (err) {
    return j({ error: (err as Error).message }, 500);
  }
});
