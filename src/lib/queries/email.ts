import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export async function emailApi<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("email-api", { body: { action, ...payload } });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json()).error ?? msg; } catch { /* noop */ }
    }
    throw new Error(msg);
  }
  if (data?.error && !data?.id) throw new Error(data.error);
  return data as T;
}

const ACC_COLS = "id, kind, provider, owner_user_id, allowed_user_ids, email, display_name, signature, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, username, status, last_error, last_sync_at";

export function useEmailAccounts() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-accounts", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_accounts").select(ACC_COLS).eq("tenant_id", tenantId!).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailSettings() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-settings", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("email_settings").select("*").eq("tenant_id", tenantId!).maybeSingle();
      return data ?? { send_mode: "mixed", default_bulk_provider_id: null };
    },
  });
}

export function useEmailProviders() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-providers", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_providers").select("id, provider, name, from_email, from_name, config, status, last_error").eq("tenant_id", tenantId!).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailTemplates() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-templates", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailThreads(opts: { ownerId?: string | null; contactId?: string | null; search?: string }) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-threads", tenantId, opts], enabled: !!tenantId, refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase.from("email_threads").select("id, subject, last_message_at, last_snippet, unread, owner_id, account_id, contact_id, deal_id, contacts:contact_id(id, name, email)").eq("tenant_id", tenantId!).order("last_message_at", { ascending: false }).limit(200);
      if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
      if (opts.contactId) q = q.eq("contact_id", opts.contactId);
      if (opts.search) q = q.ilike("subject", `%${opts.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useEmailMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["email-messages", threadId], enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_messages").select("id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, sent_at, status").eq("thread_id", threadId!).order("sent_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailCampaigns() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["email-campaigns", tenantId], enabled: !!tenantId, refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_campaigns").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { contact_id?: string; thread_id?: string; subject?: string; text: string; account_id?: string; cc?: string[]; attachments?: { filename: string; content: string; contentType?: string }[] }) => emailApi("send", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-threads"] }); qc.invalidateQueries({ queryKey: ["email-messages"] }); },
  });
}

export const PROVIDER_PRESETS: Record<string, { label: string; smtp_host: string; smtp_port: number; imap_host: string; imap_port: number; hint?: string }> = {
  gmail: { label: "Gmail / Google Workspace", smtp_host: "smtp.gmail.com", smtp_port: 465, imap_host: "imap.gmail.com", imap_port: 993, hint: "Usa una «contraseña de aplicación» de Google (Cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones)." },
  outlook: { label: "Outlook / Microsoft 365", smtp_host: "smtp.office365.com", smtp_port: 587, imap_host: "outlook.office365.com", imap_port: 993, hint: "Tu administrador de Microsoft 365 debe tener habilitado SMTP autenticado e IMAP para la cuenta." },
  zoho: { label: "Zoho Mail", smtp_host: "smtp.zoho.com", smtp_port: 465, imap_host: "imap.zoho.com", imap_port: 993 },
  yahoo: { label: "Yahoo", smtp_host: "smtp.mail.yahoo.com", smtp_port: 465, imap_host: "imap.mail.yahoo.com", imap_port: 993, hint: "Requiere contraseña de aplicación." },
  hostinger: { label: "Hostinger", smtp_host: "smtp.hostinger.com", smtp_port: 465, imap_host: "imap.hostinger.com", imap_port: 993 },
  godaddy: { label: "GoDaddy", smtp_host: "smtpout.secureserver.net", smtp_port: 465, imap_host: "imap.secureserver.net", imap_port: 993 },
  otro: { label: "Otro (cPanel, propio…)", smtp_host: "", smtp_port: 465, imap_host: "", imap_port: 993 },
};

export const BULK_PROVIDERS: Record<string, { label: string; secretLabel: string; fields: { key: string; label: string; placeholder?: string }[] }> = {
  brevo: { label: "Brevo", secretLabel: "Clave API (v3)", fields: [] },
  sendgrid: { label: "SendGrid", secretLabel: "Clave API", fields: [] },
  mandrill: { label: "Mailchimp Transactional (Mandrill)", secretLabel: "Clave API de Mandrill", fields: [] },
  mailgun: { label: "Mailgun", secretLabel: "Clave API privada", fields: [{ key: "domain", label: "Dominio de envío", placeholder: "mg.tudominio.com" }, { key: "region", label: "Región (us o eu)", placeholder: "us" }] },
  ses: { label: "Amazon SES", secretLabel: "Secret access key", fields: [{ key: "access_key_id", label: "Access key ID" }, { key: "region", label: "Región", placeholder: "us-east-1" }] },
  smtp: { label: "SMTP genérico", secretLabel: "Contraseña", fields: [{ key: "host", label: "Servidor SMTP" }, { key: "port", label: "Puerto", placeholder: "587" }, { key: "username", label: "Usuario" }] },
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
