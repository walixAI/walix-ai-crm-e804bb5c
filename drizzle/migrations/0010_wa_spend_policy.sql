ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS wa_spend_policy jsonb NOT NULL DEFAULT '{"per_lead_gap_hours":24,"per_lead_max":3,"per_user_daily":30,"monthly_cap":null,"include_bot":true}'::jsonb;

CREATE OR REPLACE FUNCTION public.wa_is_spend_manager(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_platform(_user_id)
    OR public.has_tenant_role(_user_id, 'tenant_admin', _tenant_id)
    OR public.has_tenant_role(_user_id, 'tenant_owner', _tenant_id)
    OR public.has_tenant_role(_user_id, 'sales_manager', _tenant_id)
    OR public.has_tenant_role(_user_id, 'org_owner', _tenant_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.wa_template_policy_check(_tenant_id uuid, _contact_id uuid, _user_id uuid DEFAULT NULL, _bot boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p jsonb; v_gap numeric; v_max int; v_daily int; v_cap numeric; v_bot boolean;
  v_last_in timestamptz; v_attempts int; v_last_try timestamptz; v_user_today int := 0;
  v_used numeric := 0; v_mgr boolean; v_extra int := 0; cf jsonb; v_reason text; v_msg text; v_next timestamptz;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_use_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT wa_spend_policy INTO p FROM tenants WHERE id = _tenant_id;
  p := COALESCE(p, '{}'::jsonb);
  v_gap := COALESCE((p->>'per_lead_gap_hours')::numeric, 24);
  v_max := COALESCE((p->>'per_lead_max')::int, 3);
  v_daily := COALESCE((p->>'per_user_daily')::int, 30);
  v_cap := NULLIF(p->>'monthly_cap','')::numeric;
  v_bot := COALESCE((p->>'include_bot')::boolean, true);
  v_mgr := NOT _bot AND public.wa_is_spend_manager(_user_id, _tenant_id);

  SELECT max(m.created_at) INTO v_last_in FROM messages m JOIN conversations c ON c.id = m.conversation_id
   WHERE c.tenant_id = _tenant_id AND c.contact_id = _contact_id AND m.direction = 'inbound';

  IF v_last_in IS NOT NULL AND v_last_in > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('allowed', true, 'window_open', true, 'is_manager', v_mgr);
  END IF;

  SELECT count(*), max(m.created_at) INTO v_attempts, v_last_try FROM messages m JOIN conversations c ON c.id = m.conversation_id
   WHERE c.tenant_id = _tenant_id AND c.contact_id = _contact_id AND m.direction = 'outbound'
     AND m.metadata->>'kind' = 'template' AND COALESCE(m.metadata->>'provider_error','') = ''
     AND m.created_at > COALESCE(v_last_in, '-infinity'::timestamptz)
     AND (v_bot OR COALESCE(m.metadata->>'bot','false') <> 'true');

  SELECT custom_fields INTO cf FROM contacts WHERE id = _contact_id;
  IF cf ? '_wa_extra' AND COALESCE(cf->'_wa_extra'->>'after','') = COALESCE(v_last_in::text,'') THEN
    v_extra := COALESCE((cf->'_wa_extra'->>'n')::int, 0);
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT count(*) INTO v_user_today FROM messages m
     WHERE m.tenant_id = _tenant_id AND m.direction = 'outbound' AND m.metadata->>'kind' = 'template'
       AND m.metadata->>'sent_by_user_id' = _user_id::text AND m.created_at >= date_trunc('day', now());
  END IF;

  SELECT COALESCE(whatsapp_used,0) INTO v_used FROM tenant_credit_balances
   WHERE tenant_id = _tenant_id AND period_start = date_trunc('month', CURRENT_DATE)::date LIMIT 1;

  IF v_cap IS NOT NULL AND COALESCE(v_used,0) >= v_cap THEN
    v_reason := 'monthly_cap'; v_msg := 'Se alcanzó el tope mensual de gasto en WhatsApp. Solo un administrador puede enviar plantillas.';
  ELSIF v_attempts >= v_max + v_extra THEN
    v_reason := 'lead_max'; v_msg := format('Ya se mandaron %s plantillas sin respuesta a este lead.', v_attempts);
  ELSIF v_last_try IS NOT NULL AND v_last_try > now() - make_interval(secs => v_gap * 3600) THEN
    v_reason := 'lead_gap'; v_next := v_last_try + make_interval(secs => v_gap * 3600);
    v_msg := 'Ya se le mandó una plantilla hace poco. Espera antes del siguiente intento.';
  ELSIF NOT _bot AND v_user_today >= v_daily THEN
    v_reason := 'user_daily'; v_msg := format('Llegaste a tu límite de %s plantillas pagadas hoy.', v_daily);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_reason IS NULL OR v_mgr,
    'window_open', false,
    'reason', v_reason, 'message', v_msg, 'next_at', v_next,
    'attempt', v_attempts + 1, 'max', v_max + v_extra,
    'is_manager', v_mgr, 'bypass', v_reason IS NOT NULL AND v_mgr,
    'monthly_used', v_used, 'monthly_cap', v_cap
  );
END $$;

CREATE OR REPLACE FUNCTION public.wa_grant_extra_attempt(_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_last_in timestamptz; cf jsonb; n int := 0;
BEGIN
  SELECT tenant_id, custom_fields INTO v_tenant, cf FROM contacts WHERE id = _contact_id;
  IF v_tenant IS NULL OR NOT public.wa_is_spend_manager(auth.uid(), v_tenant) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT max(m.created_at) INTO v_last_in FROM messages m JOIN conversations c ON c.id = m.conversation_id
   WHERE c.contact_id = _contact_id AND m.direction = 'inbound';
  IF cf ? '_wa_extra' AND COALESCE(cf->'_wa_extra'->>'after','') = COALESCE(v_last_in::text,'') THEN
    n := COALESCE((cf->'_wa_extra'->>'n')::int, 0);
  END IF;
  UPDATE contacts SET custom_fields = COALESCE(custom_fields,'{}'::jsonb) || jsonb_build_object('_wa_extra',
    jsonb_build_object('n', n + 1, 'after', COALESCE(v_last_in::text,''), 'by', auth.uid(), 'at', now()))
   WHERE id = _contact_id;
  RETURN jsonb_build_object('ok', true, 'extra', n + 1);
END $$;

CREATE OR REPLACE FUNCTION public.wa_refund_last_charge(_tenant_id uuid, _contact_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_use_tenant(auth.uid(), _tenant_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM whatsapp_conversation_billing
   WHERE tenant_id = _tenant_id AND contact_id = _contact_id AND direction = 'outbound'
     AND created_at > now() - interval '5 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF r IS NULL THEN RETURN false; END IF;
  UPDATE tenant_credit_balances SET whatsapp_used = GREATEST(0, COALESCE(whatsapp_used,0) - CEIL(r.credits_charged)::int)
   WHERE tenant_id = _tenant_id AND period_start = date_trunc('month', r.created_at)::date;
  DELETE FROM whatsapp_conversation_billing WHERE id = r.id;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.wa_is_spend_manager(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.wa_template_policy_check(uuid, uuid, uuid, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.wa_grant_extra_attempt(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.wa_refund_last_charge(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_is_spend_manager(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wa_template_policy_check(uuid, uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wa_grant_extra_attempt(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wa_refund_last_charge(uuid, uuid) TO authenticated, service_role;