-- 1. Canales: varios por tenant + canal global de plataforma
ALTER TABLE public.whatsapp_channels DROP CONSTRAINT IF EXISTS whatsapp_channels_tenant_id_kind_key;
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;

UPDATE public.whatsapp_channels SET is_default = true WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_channels_default
  ON public.whatsapp_channels (tenant_id, kind) WHERE is_default AND tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_channels_phone_number_id
  ON public.whatsapp_channels (phone_number_id) WHERE phone_number_id IS NOT NULL;

DROP POLICY IF EXISTS "admin select wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin select wa channels" ON public.whatsapp_channels FOR SELECT
  USING (
    public.is_platform(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid()) AND (
      public.has_role(auth.uid(),'tenant_admin'::app_role) OR public.has_role(auth.uid(),'tenant_owner'::app_role)
    ))
  );

DROP POLICY IF EXISTS "admin insert wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin insert wa channels" ON public.whatsapp_channels FOR INSERT
  WITH CHECK (
    public.is_platform(auth.uid())
    OR (tenant_id IS NOT NULL AND is_platform = false AND tenant_id = public.get_user_tenant(auth.uid()) AND (
      public.has_role(auth.uid(),'tenant_admin'::app_role) OR public.has_role(auth.uid(),'tenant_owner'::app_role)
    ))
  );

DROP POLICY IF EXISTS "admin update wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin update wa channels" ON public.whatsapp_channels FOR UPDATE
  USING (
    public.is_platform(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid()) AND (
      public.has_role(auth.uid(),'tenant_admin'::app_role) OR public.has_role(auth.uid(),'tenant_owner'::app_role)
    ))
  );

DROP POLICY IF EXISTS "admin delete wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin delete wa channels" ON public.whatsapp_channels FOR DELETE
  USING (
    public.is_platform(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid()) AND (
      public.has_role(auth.uid(),'tenant_admin'::app_role) OR public.has_role(auth.uid(),'tenant_owner'::app_role)
    ))
  );

-- 2. Conversaciones recuerdan su canal
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel_id);

-- 3. Teléfonos autorizados: unicidad global
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_user_access_phone ON public.whatsapp_user_access (phone_e164);

-- 4. Bandera de número dedicado para el equipo
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS wa_team_dedicated boolean NOT NULL DEFAULT false;

-- 5. Tarifario de WhatsApp (solo plataforma edita)
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'MX',
  category text NOT NULL,
  provider_cost_mxn numeric NOT NULL DEFAULT 0,
  credit_factor numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, category)
);
GRANT SELECT ON public.whatsapp_rate_card TO authenticated;
GRANT ALL ON public.whatsapp_rate_card TO service_role;
ALTER TABLE public.whatsapp_rate_card ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rate card" ON public.whatsapp_rate_card FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform manage rate card" ON public.whatsapp_rate_card FOR ALL TO authenticated
  USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));
CREATE TRIGGER trg_wa_rate_card_updated BEFORE UPDATE ON public.whatsapp_rate_card
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Conversaciones facturables de 24 h
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  channel_id uuid REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'service',
  direction text NOT NULL DEFAULT 'outbound',
  window_start timestamptz NOT NULL DEFAULT now(),
  window_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  credits_charged numeric NOT NULL DEFAULT 0,
  provider_cost_mxn numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_billing_tenant_window ON public.whatsapp_conversation_billing(tenant_id, window_expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_billing_contact ON public.whatsapp_conversation_billing(contact_id, window_expires_at DESC);
GRANT SELECT ON public.whatsapp_conversation_billing TO authenticated;
GRANT ALL ON public.whatsapp_conversation_billing TO service_role;
ALTER TABLE public.whatsapp_conversation_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins read wa billing" ON public.whatsapp_conversation_billing FOR SELECT TO authenticated
  USING (
    public.is_platform(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid()) AND (
      public.has_role(auth.uid(),'tenant_admin'::app_role) OR public.has_role(auth.uid(),'tenant_owner'::app_role)
      OR public.has_role(auth.uid(),'sales_manager'::app_role)
    ))
  );
CREATE TRIGGER trg_wa_billing_updated BEFORE UPDATE ON public.whatsapp_conversation_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Ventana abierta con un contacto
CREATE OR REPLACE FUNCTION public.wa_open_window(_tenant_id uuid, _contact_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT max(window_expires_at) FROM public.whatsapp_conversation_billing
  WHERE tenant_id = _tenant_id AND contact_id = _contact_id AND window_expires_at > now()
$$;

-- 8. Cobro de conversación
CREATE OR REPLACE FUNCTION public.wa_charge_conversation(
  _tenant_id uuid,
  _contact_id uuid,
  _conversation_id uuid,
  _channel_id uuid,
  _category text DEFAULT 'service',
  _direction text DEFAULT 'outbound'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_open timestamptz;
  v_rate record;
  v_bal record;
  v_period date := date_trunc('month', CURRENT_DATE)::date;
  v_available numeric;
  v_credits numeric;
BEGIN
  v_open := public.wa_open_window(_tenant_id, _contact_id);
  IF v_open IS NOT NULL THEN
    RETURN jsonb_build_object('charged', false, 'reason', 'window_open', 'window_expires_at', v_open);
  END IF;

  SELECT * INTO v_rate FROM public.whatsapp_rate_card
   WHERE country_code = 'MX' AND category = _category LIMIT 1;
  v_credits := COALESCE(v_rate.credit_factor, 1);

  SELECT * INTO v_bal FROM public.tenant_credit_balances
   WHERE tenant_id = _tenant_id AND period_start = v_period LIMIT 1;

  IF v_bal IS NULL THEN
    INSERT INTO public.tenant_credit_balances (tenant_id, period_start)
    VALUES (_tenant_id, v_period)
    ON CONFLICT DO NOTHING;
    SELECT * INTO v_bal FROM public.tenant_credit_balances
     WHERE tenant_id = _tenant_id AND period_start = v_period LIMIT 1;
  END IF;

  v_available := COALESCE(v_bal.whatsapp_included,0) + COALESCE(v_bal.whatsapp_purchased,0) - COALESCE(v_bal.whatsapp_used,0);

  IF _direction = 'outbound' AND v_available < v_credits THEN
    RETURN jsonb_build_object('charged', false, 'reason', 'insufficient_credits', 'available', v_available);
  END IF;

  IF _direction = 'outbound' THEN
    UPDATE public.tenant_credit_balances
       SET whatsapp_used = COALESCE(whatsapp_used,0) + CEIL(v_credits)::int
     WHERE id = v_bal.id;
  ELSE
    v_credits := 0;
  END IF;

  INSERT INTO public.whatsapp_conversation_billing (
    tenant_id, channel_id, contact_id, conversation_id, category, direction,
    window_start, window_expires_at, credits_charged, provider_cost_mxn
  ) VALUES (
    _tenant_id, _channel_id, _contact_id, _conversation_id, _category, _direction,
    now(), now() + interval '24 hours', v_credits, COALESCE(v_rate.provider_cost_mxn, 0)
  );

  RETURN jsonb_build_object('charged', _direction = 'outbound', 'credits', v_credits, 'window_expires_at', now() + interval '24 hours');
END;
$$;
