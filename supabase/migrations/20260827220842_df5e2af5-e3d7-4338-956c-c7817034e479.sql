-- Flags
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS feature_wa_campaigns boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS track_ip boolean NOT NULL DEFAULT true;

-- =============== wa_templates ===============
CREATE TABLE public.wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'es_MX',
  category text,
  status text NOT NULL DEFAULT 'APPROVED',
  body_text text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  components jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_templates TO authenticated;
GRANT ALL ON public.wa_templates TO service_role;
ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_templates tenant read" ON public.wa_templates FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "wa_templates tenant insert" ON public.wa_templates FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_templates tenant update" ON public.wa_templates FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_templates tenant delete" ON public.wa_templates FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_wa_templates_updated BEFORE UPDATE ON public.wa_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== wa_campaigns ===============
CREATE TABLE public.wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'calificar',
  rule_mode text NOT NULL DEFAULT 'filters' CHECK (rule_mode IN ('filters','prompt')),
  rule_prompt text,
  rule_unresolved jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 1,
  schedule jsonb NOT NULL DEFAULT '{"days":[1,2,3,4,5],"start":"09:00","end":"20:00","tz":"America/Mexico_City"}'::jsonb,
  stop_on_reply boolean NOT NULL DEFAULT true,
  stop_on_stage_change boolean NOT NULL DEFAULT true,
  stop_on_closed boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campaigns TO authenticated;
GRANT ALL ON public.wa_campaigns TO service_role;
ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_campaigns tenant read" ON public.wa_campaigns FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "wa_campaigns tenant insert" ON public.wa_campaigns FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_campaigns tenant update" ON public.wa_campaigns FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_campaigns tenant delete" ON public.wa_campaigns FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_wa_campaigns_updated BEFORE UPDATE ON public.wa_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== wa_campaign_steps ===============
CREATE TABLE public.wa_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  wait_hours integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'template' CHECK (kind IN ('template','text')),
  template_id uuid REFERENCES public.wa_templates(id) ON DELETE SET NULL,
  template_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campaign_steps TO authenticated;
GRANT ALL ON public.wa_campaign_steps TO service_role;
ALTER TABLE public.wa_campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_campaign_steps tenant read" ON public.wa_campaign_steps FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "wa_campaign_steps tenant insert" ON public.wa_campaign_steps FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_campaign_steps tenant update" ON public.wa_campaign_steps FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_campaign_steps tenant delete" ON public.wa_campaign_steps FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_wa_campaign_steps_updated BEFORE UPDATE ON public.wa_campaign_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== wa_enrollments ===============
CREATE TABLE public.wa_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped','failed')),
  current_step integer NOT NULL DEFAULT 0,
  next_send_at timestamptz,
  exit_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX idx_wa_enrollments_due ON public.wa_enrollments (status, next_send_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_enrollments TO authenticated;
GRANT ALL ON public.wa_enrollments TO service_role;
ALTER TABLE public.wa_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_enrollments tenant read" ON public.wa_enrollments FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "wa_enrollments tenant insert" ON public.wa_enrollments FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_enrollments tenant update" ON public.wa_enrollments FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_enrollments tenant delete" ON public.wa_enrollments FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_wa_enrollments_updated BEFORE UPDATE ON public.wa_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== wa_step_sends ===============
CREATE TABLE public.wa_step_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.wa_campaigns(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.wa_enrollments(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.wa_campaign_steps(id) ON DELETE SET NULL,
  step_order integer,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  blast_id uuid,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','delivered','read','failed','cancelled','pending_template')),
  stage_id uuid,
  stage_name text,
  result text,
  result_typification text,
  comment text,
  wamid text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_step_sends_campaign ON public.wa_step_sends (campaign_id, created_at DESC);
CREATE INDEX idx_wa_step_sends_wamid ON public.wa_step_sends (wamid);
CREATE INDEX idx_wa_step_sends_contact ON public.wa_step_sends (contact_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_step_sends TO authenticated;
GRANT ALL ON public.wa_step_sends TO service_role;
ALTER TABLE public.wa_step_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_step_sends tenant read" ON public.wa_step_sends FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "wa_step_sends tenant insert" ON public.wa_step_sends FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_step_sends tenant update" ON public.wa_step_sends FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "wa_step_sends tenant delete" ON public.wa_step_sends FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_wa_step_sends_updated BEFORE UPDATE ON public.wa_step_sends FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== lead_intake_keys ===============
CREATE TABLE public.lead_intake_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Sitio web',
  api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_intake_keys TO authenticated;
GRANT ALL ON public.lead_intake_keys TO service_role;
ALTER TABLE public.lead_intake_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_intake_keys tenant read" ON public.lead_intake_keys FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "lead_intake_keys tenant insert" ON public.lead_intake_keys FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "lead_intake_keys tenant update" ON public.lead_intake_keys FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "lead_intake_keys tenant delete" ON public.lead_intake_keys FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_lead_intake_keys_updated BEFORE UPDATE ON public.lead_intake_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== contact_attribution ===============
CREATE TABLE public.contact_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  touch_type text NOT NULL DEFAULT 'first' CHECK (touch_type IN ('first','last')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  msclkid text,
  wbraid text,
  gbraid text,
  ga_channel text,
  referrer text,
  landing_url text,
  landing_path text,
  source_kind text,
  meta_ad_id text,
  meta_adset_id text,
  meta_campaign_id text,
  meta_form_id text,
  meta_platform text,
  ip_address text,
  country text,
  region text,
  city text,
  postal_code text,
  timezone text,
  language text,
  device_type text,
  os text,
  browser text,
  user_agent text,
  touch_count integer NOT NULL DEFAULT 1,
  touched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, touch_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_attribution TO authenticated;
GRANT ALL ON public.contact_attribution TO service_role;
ALTER TABLE public.contact_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_attribution tenant read" ON public.contact_attribution FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "contact_attribution tenant insert" ON public.contact_attribution FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "contact_attribution tenant update" ON public.contact_attribution FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "contact_attribution tenant delete" ON public.contact_attribution FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_contact_attribution_updated BEFORE UPDATE ON public.contact_attribution FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS attribution_id uuid REFERENCES public.contact_attribution(id) ON DELETE SET NULL;

-- =============== meta_form_mappings ===============
CREATE TABLE public.meta_form_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id text,
  form_name text,
  is_default boolean NOT NULL DEFAULT false,
  utm_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  leads_count integer NOT NULL DEFAULT 0,
  last_lead_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, form_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_form_mappings TO authenticated;
GRANT ALL ON public.meta_form_mappings TO service_role;
ALTER TABLE public.meta_form_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_form_mappings tenant read" ON public.meta_form_mappings FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "meta_form_mappings tenant insert" ON public.meta_form_mappings FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "meta_form_mappings tenant update" ON public.meta_form_mappings FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "meta_form_mappings tenant delete" ON public.meta_form_mappings FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_meta_form_mappings_updated BEFORE UPDATE ON public.meta_form_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();