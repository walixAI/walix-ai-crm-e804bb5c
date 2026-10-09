CREATE OR REPLACE FUNCTION public.email_is_supervisor(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_tenant_role(_user_id,'tenant_owner'::app_role,_tenant_id)
      or public.has_tenant_role(_user_id,'tenant_admin'::app_role,_tenant_id)
      or public.has_tenant_role(_user_id,'sales_manager'::app_role,_tenant_id)
      or public.is_platform(_user_id)
$$;

CREATE TABLE public.email_settings (
  tenant_id uuid PRIMARY KEY,
  send_mode text NOT NULL DEFAULT 'mixed' CHECK (send_mode IN ('own','generic','mixed')),
  default_bulk_provider_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read email_settings" ON public.email_settings FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "write email_settings" ON public.email_settings FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND (has_tenant_role(auth.uid(),'tenant_owner',tenant_id) OR has_tenant_role(auth.uid(),'tenant_admin',tenant_id)))
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND (has_tenant_role(auth.uid(),'tenant_owner',tenant_id) OR has_tenant_role(auth.uid(),'tenant_admin',tenant_id)));

CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal','generic')),
  provider text NOT NULL CHECK (provider IN ('gmail','outlook','imap')),
  owner_user_id uuid,
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  email text NOT NULL,
  display_name text,
  signature text,
  smtp_host text, smtp_port int, smtp_secure boolean DEFAULT true,
  imap_host text, imap_port int, imap_secure boolean DEFAULT true,
  username text,
  secret_ciphertext text,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  last_sync_at timestamptz,
  sync_cursor text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_accounts TO authenticated;
GRANT ALL ON public.email_accounts TO service_role;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read email_accounts" ON public.email_accounts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
REVOKE SELECT (secret_ciphertext) ON public.email_accounts FROM authenticated;

CREATE TABLE public.email_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('brevo','sendgrid','mandrill','ses','mailgun','smtp')),
  name text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  config jsonb NOT NULL DEFAULT '{}',
  secret_ciphertext text,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_providers TO authenticated;
GRANT ALL ON public.email_providers TO service_role;
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read email_providers" ON public.email_providers FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()) AND email_is_supervisor(auth.uid(), tenant_id));
REVOKE SELECT (secret_ciphertext) ON public.email_providers FROM authenticated;

CREATE TABLE public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid,
  owner_id uuid,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_snippet text,
  unread boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.email_threads(tenant_id, last_message_at DESC);
CREATE INDEX ON public.email_threads(contact_id);
GRANT SELECT, UPDATE ON public.email_threads TO authenticated;
GRANT ALL ON public.email_threads TO service_role;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see email_threads" ON public.email_threads FOR SELECT TO authenticated USING (
  tenant_id = get_user_tenant(auth.uid()) AND (
    email_is_supervisor(auth.uid(), tenant_id) OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.owner_id = auth.uid())));
CREATE POLICY "update email_threads" ON public.email_threads FOR UPDATE TO authenticated USING (
  tenant_id = get_user_tenant(auth.uid()) AND (
    email_is_supervisor(auth.uid(), tenant_id) OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.owner_id = auth.uid())));

CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_email text, to_emails text[] NOT NULL DEFAULT '{}', cc_emails text[] NOT NULL DEFAULT '{}',
  subject text, body_text text, body_html text,
  message_id text, in_reply_to text, provider_message_id text,
  sent_by uuid,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.email_messages(thread_id, sent_at);
CREATE UNIQUE INDEX email_messages_tenant_msgid ON public.email_messages(tenant_id, message_id) WHERE message_id IS NOT NULL;
GRANT SELECT ON public.email_messages TO authenticated;
GRANT ALL ON public.email_messages TO service_role;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see email_messages" ON public.email_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.email_threads t WHERE t.id = thread_id));

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant email_templates" ON public.email_templates FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid())) WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant email_suppressions" ON public.email_suppressions FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid())) WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  provider_id uuid REFERENCES public.email_providers(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  conditions jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup email_campaigns" ON public.email_campaigns FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND email_is_supervisor(auth.uid(), tenant_id))
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND email_is_supervisor(auth.uid(), tenant_id));

CREATE TABLE public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  opened_at timestamptz, clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
CREATE INDEX ON public.email_campaign_recipients(campaign_id, status);
GRANT SELECT ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup email_campaign_recipients" ON public.email_campaign_recipients FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND email_is_supervisor(auth.uid(), tenant_id));