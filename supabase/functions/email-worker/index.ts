// Corre cada 5 min: lee buzones IMAP (solo correos de contactos) y envía lotes de campañas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { imapFetchNew, bulkSend, renderVars, textToHtml, hmacToken, json } from "../_shared/email.ts";

const APP_URL = "https://s1.walix.app";
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out = { synced: 0, inbound: 0, sent: 0, failed: 0, errors: [] as string[] };

  // ---------- 1. Lectura de buzones ----------
  const { data: accounts } = await sb.from("email_accounts").select("*").eq("provider", "imap").eq("status", "connected");
  for (const acc of accounts ?? []) {
    try {
      const { mails, cursor } = await imapFetchNew(acc, 100);
      for (const m of mails) {
        if (!m.from || m.from === acc.email.toLowerCase()) continue;
        const { data: contact } = await sb.from("contacts").select("id, owner_id").eq("tenant_id", acc.tenant_id).ilike("email", m.from).limit(1).maybeSingle();
        if (!contact) continue; // no es un lead: se ignora
        if (m.messageId) {
          const { data: dup } = await sb.from("email_messages").select("id").eq("tenant_id", acc.tenant_id).eq("message_id", m.messageId).maybeSingle();
          if (dup) continue;
        }
        let threadId: string | null = null;
        const refs = [m.inReplyTo, ...m.references].filter(Boolean) as string[];
        if (refs.length) {
          const { data: prev } = await sb.from("email_messages").select("thread_id").eq("tenant_id", acc.tenant_id).in("message_id", refs).limit(1).maybeSingle();
          threadId = prev?.thread_id ?? null;
        }
        if (!threadId) {
          const { data: t } = await sb.from("email_threads").select("id").eq("tenant_id", acc.tenant_id).eq("contact_id", contact.id).eq("account_id", acc.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
          threadId = t?.id ?? null;
        }
        if (!threadId) {
          const { data: deal } = await sb.from("deals").select("id").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          const { data: t } = await sb.from("email_threads").insert({ tenant_id: acc.tenant_id, account_id: acc.id, contact_id: contact.id, deal_id: deal?.id ?? null, owner_id: contact.owner_id ?? acc.owner_user_id, subject: m.subject }).select("id").single();
          threadId = t!.id;
        }
        await sb.from("email_messages").insert({ tenant_id: acc.tenant_id, thread_id: threadId, account_id: acc.id, direction: "inbound", from_email: m.from, to_emails: m.to, cc_emails: m.cc, subject: m.subject, body_text: m.text, body_html: m.html, message_id: m.messageId, in_reply_to: m.inReplyTo, sent_at: m.date.toISOString() });
        await sb.from("email_threads").update({ last_message_at: m.date.toISOString(), last_snippet: (m.text || "").slice(0, 160), unread: true }).eq("id", threadId);
        await sb.from("activities").insert({ tenant_id: acc.tenant_id, contact_id: contact.id, type: "email", description: `Email recibido: ${m.subject}\n${(m.text || "").slice(0, 400)}`, metadata: { direction: "inbound", thread_id: threadId } }).then(() => {}, () => {});
        await sb.from("contacts").update({ last_activity_at: m.date.toISOString() }).eq("id", contact.id);
        out.inbound++;
      }
      await sb.from("email_accounts").update({ sync_cursor: cursor, last_sync_at: new Date().toISOString(), last_error: null }).eq("id", acc.id);
      out.synced++;
    } catch (e) {
      const msg = (e as Error).message;
      out.errors.push(`${acc.email}: ${msg}`);
      await sb.from("email_accounts").update({ last_error: msg, last_sync_at: new Date().toISOString() }).eq("id", acc.id);
    }
  }

  // ---------- 2. Campañas ----------
  const { data: camps } = await sb.from("email_campaigns").select("*").in("status", ["sending", "scheduled"]).lte("scheduled_at", new Date().toISOString());
  for (const camp of camps ?? []) {
    const { data: prov } = await sb.from("email_providers").select("*").eq("id", camp.provider_id).maybeSingle();
    if (!prov) { await sb.from("email_campaigns").update({ status: "failed" }).eq("id", camp.id); continue; }
    if (camp.status === "scheduled") await sb.from("email_campaigns").update({ status: "sending" }).eq("id", camp.id);
    const { data: tenant } = await sb.from("tenants").select("name").eq("id", camp.tenant_id).maybeSingle();
    const { data: recips } = await sb.from("email_campaign_recipients").select("id, email, contact_id").eq("campaign_id", camp.id).eq("status", "queued").limit(BATCH);
    const { data: sup } = await sb.from("email_suppressions").select("email").eq("tenant_id", camp.tenant_id);
    const supSet = new Set((sup ?? []).map((s: any) => s.email.toLowerCase()));
    let sent = 0, failed = 0;
    for (const r of recips ?? []) {
      if (supSet.has(r.email)) { await sb.from("email_campaign_recipients").update({ status: "suppressed" }).eq("id", r.id); continue; }
      const { data: c } = await sb.from("contacts").select("name, company").eq("id", r.contact_id).maybeSingle();
      const vars = { nombre: (c?.name ?? "").split(/\s+/)[0], nombre_completo: c?.name ?? "", empresa: tenant?.name ?? "", compania: c?.company ?? "" };
      const unsub = `${APP_URL}/baja-email?t=${camp.tenant_id}&e=${encodeURIComponent(r.email)}&s=${await hmacToken(`${camp.tenant_id}|${r.email}`)}`;
      const text = renderVars(camp.body, vars);
      const html = textToHtml(text) + `<p style="font-family:Arial,sans-serif;font-size:11px;color:#888;margin-top:24px">Si ya no deseas recibir estos correos, <a href="${unsub}">date de baja aquí</a>.</p>`;
      try {
        const { id } = await bulkSend(prov, { to: r.email, subject: renderVars(camp.subject, vars), html, text: `${text}\n\nDarse de baja: ${unsub}`, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, tag: camp.id });
        await sb.from("email_campaign_recipients").update({ status: "sent", provider_message_id: id, sent_at: new Date().toISOString() }).eq("id", r.id);
        sent++;
      } catch (e) {
        await sb.from("email_campaign_recipients").update({ status: "failed", error: (e as Error).message.slice(0, 500) }).eq("id", r.id);
        failed++;
      }
    }
    const { count: left } = await sb.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id).eq("status", "queued");
    const stats = camp.stats ?? {};
    await sb.from("email_campaigns").update({ status: (left ?? 0) === 0 ? "sent" : "sending", stats: { ...stats, sent: (stats.sent ?? 0) + sent, failed: (stats.failed ?? 0) + failed }, updated_at: new Date().toISOString() }).eq("id", camp.id);
    out.sent += sent; out.failed += failed;
  }

  return json(corsHeaders, out);
});
