// Shared email helpers: credential crypto, SMTP send, IMAP fetch, bulk providers, templating.
import nodemailer from "npm:nodemailer@6.9.14";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.7.1";
import { AwsClient } from "npm:aws4fetch@1.0.20";

async function aesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("EMAIL_CRED_SECRET");
  if (!raw) throw new Error("EMAIL_CRED_SECRET no configurado");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  const buf = new Uint8Array(iv.length + ct.length);
  buf.set(iv); buf.set(ct, iv.length);
  let s = ""; for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

export async function decryptSecret(stored: string): Promise<string> {
  const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, await aesKey(), buf.subarray(12));
  return new TextDecoder().decode(pt);
}

export async function hmacToken(data: string): Promise<string> {
  const raw = Deno.env.get("EMAIL_CRED_SECRET")!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function renderVars(text: string, vars: Record<string, string>): string {
  return (text ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

export function textToHtml(text: string): string {
  const esc = (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${esc.replace(/\n/g, "<br>")}</div>`;
}

export interface MailAccount {
  id: string; email: string; display_name: string | null; username: string | null;
  smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean | null;
  imap_host: string | null; imap_port: number | null; imap_secure: boolean | null;
  secret_ciphertext: string | null; sync_cursor: string | null;
}

export async function smtpSend(acc: MailAccount, msg: {
  to: string[]; cc?: string[]; subject: string; text: string; html: string;
  inReplyTo?: string | null; references?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<{ messageId: string }> {
  const pass = await decryptSecret(acc.secret_ciphertext!);
  const transport = nodemailer.createTransport({
    host: acc.smtp_host!, port: acc.smtp_port ?? 465, secure: acc.smtp_secure ?? (acc.smtp_port === 465),
    auth: { user: acc.username || acc.email, pass },
  });
  const info = await transport.sendMail({
    from: acc.display_name ? `"${acc.display_name}" <${acc.email}>` : acc.email,
    to: msg.to.join(", "), cc: msg.cc?.length ? msg.cc.join(", ") : undefined,
    subject: msg.subject, text: msg.text, html: msg.html,
    inReplyTo: msg.inReplyTo ?? undefined, references: msg.references ?? undefined,
    attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: "base64", contentType: a.contentType })),
  });
  return { messageId: info.messageId };
}

export async function smtpVerify(acc: MailAccount): Promise<void> {
  const pass = await decryptSecret(acc.secret_ciphertext!);
  const transport = nodemailer.createTransport({
    host: acc.smtp_host!, port: acc.smtp_port ?? 465, secure: acc.smtp_secure ?? (acc.smtp_port === 465),
    auth: { user: acc.username || acc.email, pass },
  });
  await transport.verify();
}

function imapClient(acc: MailAccount, pass: string) {
  return new ImapFlow({
    host: acc.imap_host!, port: acc.imap_port ?? 993, secure: acc.imap_secure ?? true,
    auth: { user: acc.username || acc.email, pass }, logger: false,
  });
}

export async function imapVerify(acc: MailAccount): Promise<void> {
  const c = imapClient(acc, await decryptSecret(acc.secret_ciphertext!));
  await c.connect(); await c.logout();
}

export interface FetchedMail {
  uid: number; messageId: string | null; inReplyTo: string | null; references: string[];
  from: string | null; to: string[]; cc: string[]; subject: string; text: string; html: string | null; date: Date;
}

/** Fetch new mails from INBOX since sync_cursor (last UID). First sync pulls last 3 days. */
export async function imapFetchNew(acc: MailAccount, max = 100): Promise<{ mails: FetchedMail[]; cursor: string }> {
  const c = imapClient(acc, await decryptSecret(acc.secret_ciphertext!));
  await c.connect();
  const mails: FetchedMail[] = [];
  let lastUid = Number(acc.sync_cursor || 0);
  const lock = await c.getMailboxLock("INBOX");
  try {
    const range = lastUid > 0 ? { uid: `${lastUid + 1}:*` } : { since: new Date(Date.now() - 3 * 864e5) };
    const uids = (await c.search(range as any, { uid: true })) || [];
    const pick = uids.filter((u: number) => u > lastUid).slice(-max);
    for (const uid of pick) {
      const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
      if (!m?.source) continue;
      const p: any = await simpleParser(m.source);
      const addrs = (x: any) => (x?.value ?? []).map((v: any) => String(v.address || "").toLowerCase()).filter(Boolean);
      mails.push({
        uid, messageId: p.messageId ?? null, inReplyTo: p.inReplyTo ?? null,
        references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
        from: addrs(p.from)[0] ?? null, to: addrs(p.to), cc: addrs(p.cc),
        subject: p.subject ?? "", text: p.text ?? "", html: typeof p.html === "string" ? p.html : null,
        date: p.date ?? new Date(),
      });
      if (uid > lastUid) lastUid = uid;
    }
  } finally { lock.release(); await c.logout().catch(() => {}); }
  return { mails, cursor: String(lastUid) };
}

// ---------- Bulk providers ----------
export interface BulkProvider {
  provider: string; from_email: string; from_name: string | null; config: Record<string, any>; secret_ciphertext: string | null;
}
export interface BulkMsg { to: string; subject: string; html: string; text: string; headers?: Record<string, string>; tag?: string }

async function fail(r: Response): Promise<never> {
  throw new Error(`[${r.status}] ${(await r.text()).slice(0, 400)}`);
}

export async function bulkSend(p: BulkProvider, m: BulkMsg): Promise<{ id: string | null }> {
  const key = p.secret_ciphertext ? await decryptSecret(p.secret_ciphertext) : "";
  const fromStr = p.from_name ? `${p.from_name} <${p.from_email}>` : p.from_email;
  switch (p.provider) {
    case "brevo": {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { email: p.from_email, name: p.from_name ?? undefined }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text, headers: m.headers, tags: m.tag ? [m.tag] : undefined }),
      });
      if (!r.ok) await fail(r);
      return { id: (await r.json()).messageId ?? null };
    }
    case "sendgrid": {
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: m.to }] }], from: { email: p.from_email, name: p.from_name ?? undefined }, subject: m.subject, content: [{ type: "text/plain", value: m.text || " " }, { type: "text/html", value: m.html }], headers: m.headers, custom_args: m.tag ? { walix: m.tag } : undefined }),
      });
      if (!r.ok) await fail(r);
      return { id: r.headers.get("x-message-id") };
    }
    case "mandrill": {
      const r = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, message: { from_email: p.from_email, from_name: p.from_name ?? undefined, to: [{ email: m.to, type: "to" }], subject: m.subject, html: m.html, text: m.text, headers: m.headers, metadata: m.tag ? { walix: m.tag } : undefined } }),
      });
      if (!r.ok) await fail(r);
      const j = await r.json();
      const row = Array.isArray(j) ? j[0] : null;
      if (row && ["rejected", "invalid"].includes(row.status)) throw new Error(`Rechazado: ${row.reject_reason ?? row.status}`);
      return { id: row?._id ?? null };
    }
    case "mailgun": {
      const domain = p.config.domain; const region = p.config.region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
      const fd = new FormData();
      fd.set("from", fromStr); fd.set("to", m.to); fd.set("subject", m.subject); fd.set("html", m.html); fd.set("text", m.text);
      for (const [k, v] of Object.entries(m.headers ?? {})) fd.set(`h:${k}`, v);
      if (m.tag) fd.set("v:walix", m.tag);
      const r = await fetch(`https://${region}/v3/${domain}/messages`, { method: "POST", headers: { Authorization: `Basic ${btoa(`api:${key}`)}` }, body: fd });
      if (!r.ok) await fail(r);
      return { id: (await r.json()).id ?? null };
    }
    case "ses": {
      const aws = new AwsClient({ accessKeyId: p.config.access_key_id, secretAccessKey: key, region: p.config.region || "us-east-1", service: "ses" });
      const r = await aws.fetch(`https://email.${p.config.region || "us-east-1"}.amazonaws.com/v2/email/outbound-emails`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FromEmailAddress: fromStr, Destination: { ToAddresses: [m.to] }, Content: { Simple: { Subject: { Data: m.subject, Charset: "UTF-8" }, Body: { Html: { Data: m.html, Charset: "UTF-8" }, Text: { Data: m.text, Charset: "UTF-8" } }, Headers: Object.entries(m.headers ?? {}).map(([Name, Value]) => ({ Name, Value })) } } }),
      });
      if (!r.ok) await fail(r);
      return { id: (await r.json()).MessageId ?? null };
    }
    case "smtp": {
      const transport = nodemailer.createTransport({ host: p.config.host, port: Number(p.config.port || 587), secure: Number(p.config.port) === 465, auth: { user: p.config.username, pass: key } });
      const info = await transport.sendMail({ from: fromStr, to: m.to, subject: m.subject, html: m.html, text: m.text, headers: m.headers });
      return { id: info.messageId };
    }
  }
  throw new Error(`Proveedor no soportado: ${p.provider}`);
}

export const json = (cors: Record<string, string>, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
