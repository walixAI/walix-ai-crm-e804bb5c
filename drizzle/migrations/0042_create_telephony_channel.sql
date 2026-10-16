
CREATE TABLE public.call_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'simulated', -- simulated | telnyx | twilio
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | error
  credentials_encrypted TEXT, -- AES-GCM, solo backend
  pbx_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- menú, horarios, buzón
  redial_rules JSONB NOT NULL DEFAULT '{"max_attempts":3,"interval_hours":2,"action":"redial"}'::jsonb,
  record_calls BOOLEAN NOT NULL DEFAULT true,
  recording_notice TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_channels TO authenticated;
GRANT ALL ON public.call_channels TO service_role;
ALTER TABLE public.call_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_channels_select" ON public.call_channels FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "call_channels_admin_insert" ON public.call_channels FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())));
CREATE POLICY "call_channels_admin_update" ON public.call_channels FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())));
CREATE POLICY "call_channels_admin_delete" ON public.call_channels FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid())));

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.call_channels(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  user_id UUID, -- asesor
  campaign_id UUID,
  direction TEXT NOT NULL DEFAULT 'outbound', -- outbound | inbound
  from_number TEXT,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | ringing | answered | completed | failed | no_answer | busy | voicemail
  provider_call_id TEXT,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  ai_suggestions JSONB, -- perfilamiento/resultado/tipificación sugeridos
  outcome TEXT, -- resultado registrado por el asesor
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (
    NOT public.is_rep_only(auth.uid(), tenant_id)
    OR user_id = auth.uid()
    OR (contact_id IS NOT NULL AND public.rep_owns_contact(auth.uid(), contact_id))
  ) OR public.is_platform(auth.uid()));
CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (
    NOT public.is_rep_only(auth.uid(), tenant_id)
    OR user_id = auth.uid()
    OR (contact_id IS NOT NULL AND public.rep_owns_contact(auth.uid(), contact_id))
  ));
CREATE POLICY "calls_delete" ON public.calls FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid())));

CREATE INDEX calls_tenant_created ON public.calls(tenant_id, created_at DESC);
CREATE INDEX calls_contact ON public.calls(contact_id);

CREATE TABLE public.call_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.call_channels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | active | paused | finished
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb, -- horarios permitidos
  redial_rules JSONB NOT NULL DEFAULT '{"max_attempts":3,"interval_hours":2,"action":"redial"}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_campaigns TO authenticated;
GRANT ALL ON public.call_campaigns TO service_role;
ALTER TABLE public.call_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_campaigns_select" ON public.call_campaigns FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "call_campaigns_admin_write" ON public.call_campaigns FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())));

CREATE TABLE public.call_campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | calling | done | failed | skipped
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_campaign_contacts TO authenticated;
GRANT ALL ON public.call_campaign_contacts TO service_role;
ALTER TABLE public.call_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_campaign_contacts_select" ON public.call_campaign_contacts FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "call_campaign_contacts_admin_write" ON public.call_campaign_contacts FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id) OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id) OR public.is_platform(auth.uid())));

-- Las llamadas se reflejan en la Actividad del lead (como WhatsApp)
CREATE OR REPLACE FUNCTION public.trg_call_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (tenant_id, contact_id, deal_id, type, description, occurred_at, metadata)
    VALUES (
      NEW.tenant_id, NEW.contact_id, NEW.deal_id, 'call',
      CASE WHEN NEW.direction = 'inbound' THEN 'Llamada entrante' ELSE 'Llamada saliente' END,
      now(), jsonb_build_object('call_id', NEW.id, 'status', NEW.status)
    );
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','failed','no_answer','busy','voicemail') THEN
    INSERT INTO public.activities (tenant_id, contact_id, deal_id, type, description, occurred_at, metadata)
    VALUES (
      NEW.tenant_id, NEW.contact_id, NEW.deal_id, 'call',
      'Llamada ' || CASE NEW.status
        WHEN 'completed' THEN 'completada (' || COALESCE(NEW.duration_seconds,0) || 's)'
        WHEN 'no_answer' THEN 'sin respuesta'
        WHEN 'busy' THEN 'ocupado'
        WHEN 'voicemail' THEN 'buzón de voz'
        ELSE 'fallida' END || COALESCE(' — ' || NEW.outcome, ''),
      COALESCE(NEW.ended_at, now()), jsonb_build_object('call_id', NEW.id, 'status', NEW.status, 'duration', NEW.duration_seconds)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER call_activity_mirror AFTER INSERT OR UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.trg_call_to_activity();
