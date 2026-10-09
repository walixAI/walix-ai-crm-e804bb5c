// Email module API: cuentas (IMAP/SMTP), proveedores masivos, envío individual y campañas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  encryptSecret, smtpSend, smtpVerify, imapVerify, bulkSend, renderVars, textToHtml, json, hmacToken,
} from "../_shared/email.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const APP_URL = "https://s1.walix.app";
const j = (b: unknown, s = 200) => json(corsHeaders, b, s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userSb = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userSb.auth.getUser();
    if (!u?.user) return j({ error: "No autenticado" }, 401);
    const uid = u.user.id;
    const sb = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tenantId } = await sb.rpc("get_user_tenant", { _user_id: uid });
    if (!tenantId) return j({ error: "Sin empresa asignada" }, 403);
    const { data: isSup } = await sb.rpc("email_is_supervisor", { _user_id: uid, _tenant_id: tenantId });
    const [{ data: own }, { data: adm }] = await Promise.all([
      sb.rpc("has_tenant_role", { _user_id: uid, _role: "tenant_owner", _tenant_id: tenantId }),
      sb.rpc("has_tenant_role", { _user_id: uid, _role: "tenant_admin", _tenant_id: tenantId }),
    ]);
    const isAdmin = !!(own || adm);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ---------- Cuentas ----------
    if (action === "save_account") {
      const a = body.account ?? {};
      const kind = a.kind === "generic" ? "generic" : "personal";
      if (kind === "generic" && !isAdmin) return j({ error: "Solo un administrador puede crear cuentas genéricas" }, 403);
      if (!a.email || !a.smtp_host || !a.imap_host) return j({ error: "Faltan correo, servidor SMTP o IMAP" }, 400);
      let existing: any = null;
      if (a.id) {
        const { data } = await sb.from("email_accounts").select("*").eq("id", a.id).eq("tenant_id", tenantId).maybeSingle();
        existing = data;
        if (!existing) return j({ error: "Cuenta no encontrada" }, 404);
        if (existing.kind === "personal" && existing.owner_user_id !== uid && !isAdmin) return j({ error: "Sin permiso" }, 403);
        if (existing.kind === "generic" && !isAdmin) return j({ error: "Sin permiso" }, 403);
      }
      const row: any = {
        tenant_id: tenantId, kind, provider: "imap",
        owner_user_id: kind === "personal" ? (existing?.owner_user_id ?? uid) : null,
        allowed_user_ids: kind === "generic" ? (a.allowed_user_ids ?? []) : [],
        email: String(a.email).trim().toLowerCase(), display_name: a.display_name ?? null, signature: a.signature ?? null,
        smtp_host: a.smtp_host, smtp_port: Number(a.smtp_port || 465), smtp_secure: a.smtp_secure ?? Number(a.smtp_port) === 465,
        imap_host: a.imap_host, imap_port: Number(a.imap_port || 993), imap_secure: a.imap_secure ?? true,
        username: a.username || null, updated_at: new Date().toISOString(),
      };
      if (a.password) row.secret_ciphertext = await encryptSecret(String(a.password));
      else if (!existing) return j({ error: "Falta la contraseña" }, 400);
      const test = { ...existing, ...row, secret_ciphertext: row.secret_ciphertext ?? existing?.secret_ciphertext };
      let status = "connected", last_error: string | null = null;
      try { await smtpVerify(test); } catch (e) { status = "error"; last_error = `SMTP: ${(e as Error).message}`; }
      if (status === "connected") { try { await imapVerify(test); } catch (e) { status = "error"; last_error = `IMAP: ${(e as Error).message}`; } }
      row.status = status; row.last_error = last_error;
      const q = existing
        ? sb.from("email_accounts").update(row).eq("id", existing.id).select("id").single()
        : sb.from("email_accounts").insert({ ...row, created_by: uid }).select("id").single();
      const { data, error } = await q;
      if (error) throw error;
      return j({ id: data.id, status, error: last_error });
    }

    if (action === "delete_account") {
      const { data: acc } = await sb.from("email_accounts").select("*").eq("id", body.id).eq("tenant_id", tenantId).maybeSingle();
      if (!acc) return j({ error: "No encontrada" }, 404);
      if (!(isAdmin || (acc.kind === "personal" && acc.owner_user_id === uid))) return j({ error: "Sin permiso" }, 403);
      await sb.from("email_accounts").delete().eq("id", acc.id);
      return j({ ok: true });
    }

    if (action === "save_settings") {
      if (!isAdmin) return j({ error: "Sin permiso" }, 403);
      await sb.from("email_settings").upsert({ tenant_id: tenantId, send_mode: body.send_mode, default_bulk_provider_id: body.default_bulk_provider_id ?? null, updated_at: new Date().toISOString() });
      return j({ ok: true });
    }

    // ---------- Proveedores masivos ----------
    if (action === "save_provider") {
      if (!isAdmin) return j({ error: "Sin permiso" }, 403);
      const p = body.provider ?? {};
      if (!p.provider || !p.name || !p.from_email) return j({ error: "Faltan datos" }, 400);
      const row: any = { tenant_id: tenantId, provider: p.provider, name: p.name, from_email: p.from_email, from_name: p.from_name ?? null, config: p.config ?? {}, updated_at: new Date().toISOString(), status: "connected", last_error: null };
      if (p.secret) row.secret_ciphertext = await encryptSecret(String(p.secret));
      else if (!p.id) return j({ error: "Falta la clave del proveedor" }, 400);
      const q = p.id
        ? sb.from("email_providers").update(row).eq("id", p.id).eq("tenant_id", tenantId).select("id").single()
        : sb.from("email_providers").insert(row).select("id").single();
      const { data, error } = await q;
      if (error) throw error;
      return j({ id: data.id });
    }
    if (action === "delete_provider") {
      if (!isAdmin) return j({ error: "Sin permiso" }, 403);
      await sb.from("email_providers").delete().eq("id", body.id).eq("tenant_id", tenantId);
      return j({ ok: true });
    }
    if (action === "test_provider") {
      if (!isAdmin) return j({ error: "Sin permiso" }, 403);
      const { data: p } = await sb.from("email_providers").select("*").eq("id", body.id).eq("tenant_id", tenantId).maybeSingle();
      if (!p) return j({ error: "No encontrado" }, 404);
      try {
        await bulkSend(p, { to: u.user.email!, subject: "Prueba de envío · Walix", text: "Tu proveedor de envío masivo quedó conectado.", html: textToHtml("Tu proveedor de envío masivo quedó conectado.") });
        await sb.from("email_providers").update({ status: "connected", last_error: null }).eq("id", p.id);
        return j({ ok: true, sent_to: u.user.email });
      } catch (e) {
        await sb.from("email_providers").update({ status: "error", last_error: (e as Error).message }).eq("id", p.id);
        return j({ error: (e as Error).message }, 400);
      }
    }

    // ---------- Envío individual ----------
    if (action === "send") {
      const { contact_id, thread_id, subject, text, cc, attachments } = body;
      if (!text?.trim()) return j({ error: "El mensaje está vacío" }, 400);
      let thread: any = null;
      if (thread_id) {
        const { data } = await sb.from("email_threads").select("*").eq("id", thread_id).eq("tenant_id", tenantId).maybeSingle();
        thread = data; if (!thread) return j({ error: "Hilo no encontrado" }, 404);
      }
      const cid = thread?.contact_id ?? contact_id;
      const { data: contact } = await sb.from("contacts").select("id, name, email, company, owner_id").eq("id", cid).eq("tenant_id", tenantId).maybeSingle();
      if (!contact?.email) return j({ error: "El contacto no tiene correo" }, 400);
      if (!isSup && contact.owner_id !== uid && thread?.owner_id !== uid) return j({ error: "Este lead no es tuyo" }, 403);

      // Elegir cuenta según la política del tenant
      const { data: settings } = await sb.from("email_settings").select("send_mode").eq("tenant_id", tenantId).maybeSingle();
      const mode = settings?.send_mode ?? "mixed";
      const { data: accounts } = await sb.from("email_accounts").select("*").eq("tenant_id", tenantId).eq("status", "connected");
      const allowed = (accounts ?? []).filter((a: any) =>
        (a.kind === "personal" && a.owner_user_id === uid && mode !== "generic") ||
        (a.kind === "generic" && mode !== "own" && (a.allowed_user_ids.length === 0 || a.allowed_user_ids.includes(uid))));
      let acc = body.account_id ? allowed.find((a: any) => a.id === body.account_id)
        : (thread?.account_id && allowed.find((a: any) => a.id === thread.account_id)) || allowed.find((a: any) => a.kind === "personal") || allowed[0];
      if (!acc) return j({ error: "No tienes una cuenta de correo conectada. Ve a Configuración → Email." }, 400);

      const { data: tenant } = await sb.from("tenants").select("name").eq("id", tenantId).maybeSingle();
      const { data: prof } = await sb.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      const vars = { nombre: (contact.name ?? "").split(/\s+/)[0], nombre_completo: contact.name ?? "", empresa: tenant?.name ?? "", compania: contact.company ?? "", asesor: prof?.full_name ?? "" };
      const subj = renderVars(subject || (thread?.subject ? (thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`) : "(sin asunto)"), vars);
      const finalText = renderVars(text, vars) + (acc.signature ? `\n\n${acc.signature}` : "");

      let lastMsg: any = null;
      if (thread) {
        const { data } = await sb.from("email_messages").select("message_id").eq("thread_id", thread.id).not("message_id", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
        lastMsg = data;
      }
      const { messageId } = await smtpSend(acc, { to: [contact.email], cc: cc ?? [], subject: subj, text: finalText, html: textToHtml(finalText), inReplyTo: lastMsg?.message_id, references: lastMsg?.message_id, attachments });

      const { data: deal } = await sb.from("deals").select("id").eq("contact_id", contact.id).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!thread) {
        const { data } = await sb.from("email_threads").insert({ tenant_id: tenantId, account_id: acc.id, contact_id: contact.id, deal_id: deal?.id ?? null, owner_id: contact.owner_id ?? uid, subject: subj }).select("*").single();
        thread = data;
      }
      await sb.from("email_messages").insert({ tenant_id: tenantId, thread_id: thread.id, account_id: acc.id, direction: "outbound", from_email: acc.email, to_emails: [contact.email], cc_emails: cc ?? [], subject: subj, body_text: finalText, message_id: messageId, in_reply_to: lastMsg?.message_id ?? null, sent_by: uid });
      await sb.from("email_threads").update({ last_message_at: new Date().toISOString(), last_snippet: finalText.slice(0, 160), unread: false }).eq("id", thread.id);
      await sb.from("activities").insert({ tenant_id: tenantId, contact_id: contact.id, deal_id: deal?.id ?? null, agent_id: uid, type: "email", description: `Email enviado: ${subj}\n${finalText.slice(0, 400)}`, metadata: { direction: "outbound", thread_id: thread.id } }).then(() => {}, () => {});
      return j({ ok: true, thread_id: thread.id });
    }

    // ---------- Campañas masivas ----------
    if (action === "campaign_preview" || action === "campaign_launch") {
      if (!isSup) return j({ error: "Sin permiso" }, 403);
      const { data: camp } = await sb.from("email_campaigns").select("*").eq("id", body.id).eq("tenant_id", tenantId).maybeSingle();
      if (!camp) return j({ error: "Campaña no encontrada" }, 404);
      const c = camp.conditions ?? {};
      let q = sb.from("contacts").select("id, email, owner_id").eq("tenant_id", tenantId).not("email", "is", null).neq("email", "");
      if (c.lifecycle?.length) q = q.in("status", c.lifecycle);
      if (c.owner_ids?.length) q = q.in("owner_id", c.owner_ids);
      if (c.tags?.length) q = q.overlaps("tags", c.tags);
      if (c.created_within_days) q = q.gte("created_at", new Date(Date.now() - c.created_within_days * 864e5).toISOString());
      let { data: rows } = await q.limit(20000);
      rows = rows ?? [];
      if (c.stage_ids?.length && rows.length) {
        const { data: deals } = await sb.from("deals").select("contact_id").eq("tenant_id", tenantId).in("stage_id", c.stage_ids);
        const ok = new Set((deals ?? []).map((d: any) => d.contact_id));
        rows = rows.filter((r: any) => ok.has(r.id));
      }
      const { data: sup } = await sb.from("email_suppressions").select("email").eq("tenant_id", tenantId);
      const supSet = new Set((sup ?? []).map((s: any) => s.email.toLowerCase()));
      const seen = new Set<string>();
      const valid = rows.filter((r: any) => {
        const e = String(r.email).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || seen.has(e)) return false;
        seen.add(e); return true;
      });
      const sendable = valid.filter((r: any) => !supSet.has(String(r.email).trim().toLowerCase()));
      const summary = { matched: rows.length, invalid_or_dup: rows.length - valid.length, suppressed: valid.length - sendable.length, sendable: sendable.length };
      if (action === "campaign_preview") return j(summary);
      if (!camp.provider_id) return j({ error: "Elige un proveedor de envío masivo" }, 400);
      if (!["draft", "scheduled"].includes(camp.status)) return j({ error: "La campaña ya se lanzó" }, 400);
      for (let i = 0; i < sendable.length; i += 500) {
        await sb.from("email_campaign_recipients").upsert(sendable.slice(i, i + 500).map((r: any) => ({ tenant_id: tenantId, campaign_id: camp.id, contact_id: r.id, email: String(r.email).trim().toLowerCase() })), { onConflict: "campaign_id,email", ignoreDuplicates: true });
      }
      const when = body.scheduled_at ? new Date(body.scheduled_at) : null;
      await sb.from("email_campaigns").update({ status: when && when > new Date() ? "scheduled" : "sending", scheduled_at: when?.toISOString() ?? new Date().toISOString(), stats: { ...summary, sent: 0, failed: 0 }, updated_at: new Date().toISOString() }).eq("id", camp.id);
      fetch(`${URL_}/functions/v1/email-worker`, { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      return j({ ok: true, ...summary });
    }

    if (action === "webhook_url") {
      if (!isAdmin) return j({ error: "Sin permiso" }, 403);
      return j({ url: `${URL_}/functions/v1/email-public?hook=${encodeURIComponent(body.provider)}&t=${tenantId}&s=${await hmacToken(`hook|${tenantId}`)}` });
    }

    if (action === "unsubscribe_link") {
      const e = String(body.email).toLowerCase();
      return j({ url: `${APP_URL}/baja-email?t=${tenantId}&e=${encodeURIComponent(e)}&s=${await hmacToken(`${tenantId}|${e}`)}` });
    }

    return j({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("email-api", e);
    return j({ error: (e as Error).message ?? String(e) }, 500);
  }
});
