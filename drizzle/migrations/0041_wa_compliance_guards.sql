ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS wa_opt_out_at timestamptz, ADD COLUMN IF NOT EXISTS wa_opt_out_reason text, ADD COLUMN IF NOT EXISTS wa_consent_at timestamptz, ADD COLUMN IF NOT EXISTS wa_consent_source text;
ALTER TABLE public.whatsapp_channels ADD COLUMN IF NOT EXISTS quality_rating text, ADD COLUMN IF NOT EXISTS messaging_limit text, ADD COLUMN IF NOT EXISTS paused_at timestamptz, ADD COLUMN IF NOT EXISTS pause_reason text;

UPDATE public.contacts c SET wa_consent_at = now(), wa_consent_source = 'histórico'
WHERE wa_consent_at IS NULL AND (
  EXISTS (SELECT 1 FROM messages m JOIN conversations v ON v.id = m.conversation_id WHERE v.contact_id = c.id AND m.direction = 'inbound')
  OR EXISTS (SELECT 1 FROM contact_attribution a WHERE a.contact_id = c.id)
  OR c.source ILIKE ANY (ARRAY['%whatsapp%','%formulario%','%web%','%meta%','%facebook%','%anuncio%','%instagram%']));

CREATE OR REPLACE FUNCTION public.contacts_auto_consent() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.wa_consent_at IS NULL AND NEW.source ILIKE ANY (ARRAY['%whatsapp%','%formulario%','%web%','%meta%','%facebook%','%anuncio%','%instagram%']) THEN
    NEW.wa_consent_at := now(); NEW.wa_consent_source := 'origen: ' || NEW.source;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contacts_auto_consent ON public.contacts;
CREATE TRIGGER trg_contacts_auto_consent BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.contacts_auto_consent();

-- Un mensaje entrante del contacto equivale a consentimiento.
CREATE OR REPLACE FUNCTION public.messages_inbound_consent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE contacts SET wa_consent_at = now(), wa_consent_source = 'escribió por WhatsApp'
    WHERE wa_consent_at IS NULL AND id = (SELECT contact_id FROM conversations WHERE id = NEW.conversation_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_messages_inbound_consent ON public.messages;
CREATE TRIGGER trg_messages_inbound_consent AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_inbound_consent();

-- Aviso a propietarios/administradores cuando se pausa un número.
CREATE OR REPLACE FUNCTION public.whatsapp_channel_pause_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.paused_at IS NOT NULL AND OLD.paused_at IS NULL THEN
    INSERT INTO notifications (tenant_id, user_id, category, type, title, body, link, severity, data)
    SELECT NEW.tenant_id, ur.user_id, 'operational', 'wa_channel_paused',
      'Envíos de WhatsApp pausados', COALESCE(NEW.pause_reason, 'Se pausaron los envíos automáticos para proteger el número.'),
      '/settings?tab=whatsapp', 'danger', jsonb_build_object('channel_id', NEW.id)
    FROM (SELECT DISTINCT user_id FROM user_roles WHERE tenant_id = NEW.tenant_id AND role IN ('tenant_owner','tenant_admin')) ur;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_whatsapp_channel_pause_notify ON public.whatsapp_channels;
CREATE TRIGGER trg_whatsapp_channel_pause_notify AFTER UPDATE OF paused_at ON public.whatsapp_channels FOR EACH ROW EXECUTE FUNCTION public.whatsapp_channel_pause_notify();

CREATE OR REPLACE FUNCTION public.wa_template_policy_check(_tenant_id uuid, _contact_id uuid, _user_id uuid DEFAULT NULL::uuid, _bot boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p jsonb; v_gap numeric; v_max int; v_daily int; v_cap numeric; v_bot boolean;
  v_last_in timestamptz; v_attempts int; v_last_try timestamptz; v_user_today int := 0;
  v_used numeric := 0; v_mgr boolean; v_extra int := 0; cf jsonb; v_reason text; v_msg text; v_next timestamptz;
  v_ct record; v_ch record; v_tot int; v_fail int; v_today int; v_hard boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_use_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT wa_spend_policy INTO p FROM tenants WHERE id = _tenant_id;
  p := COALESCE(p, '{}'::jsonb);
  -- Topes fijos de la plataforma: ninguna empresa puede superarlos.
  v_gap := GREATEST(COALESCE((p->>'per_lead_gap_hours')::numeric, 24), 12);
  v_max := LEAST(COALESCE((p->>'per_lead_max')::int, 3), 5);
  v_daily := LEAST(COALESCE((p->>'per_user_daily')::int, 30), 100);
  v_cap := NULLIF(p->>'monthly_cap','')::numeric;
  v_bot := COALESCE((p->>'include_bot')::boolean, true);
  v_mgr := NOT _bot AND public.wa_is_spend_manager(_user_id, _tenant_id);

  SELECT wa_opt_out_at, wa_consent_at, custom_fields INTO v_ct FROM contacts WHERE id = _contact_id;

  SELECT max(m.created_at) INTO v_last_in FROM messages m JOIN conversations c ON c.id = m.conversation_id
   WHERE c.tenant_id = _tenant_id AND c.contact_id = _contact_id AND m.direction = 'inbound';

  IF v_last_in IS NOT NULL AND v_last_in > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('allowed', true, 'window_open', true, 'is_manager', v_mgr,
      'opted_out', v_ct.wa_opt_out_at IS NOT NULL AND v_ct.wa_opt_out_at >= v_last_in);
  END IF;

  SELECT * INTO v_ch FROM whatsapp_channels WHERE tenant_id = _tenant_id AND kind = 'clients' AND status = 'connected' AND is_platform = false
   ORDER BY is_default DESC, position ASC LIMIT 1;

  SELECT count(*), count(*) FILTER (WHERE m.wa_status = 'failed' OR COALESCE(m.metadata->>'provider_error','') <> ''),
         count(*) FILTER (WHERE m.created_at >= date_trunc('day', now()))
    INTO v_tot, v_fail, v_today FROM messages m
   WHERE m.tenant_id = _tenant_id AND m.direction = 'outbound' AND m.metadata->>'kind' = 'template' AND m.created_at > now() - interval '24 hours';

  -- Bloqueos de protección del número (nadie puede saltarlos).
  IF v_ct.wa_opt_out_at IS NOT NULL THEN
    v_hard := true; v_reason := 'opted_out'; v_msg := 'Este contacto pidió no recibir más mensajes de WhatsApp. Solo puedes responderle si él vuelve a escribir.';
  ELSIF v_ct.wa_consent_at IS NULL AND v_last_in IS NULL THEN
    v_hard := true; v_reason := 'no_consent'; v_msg := 'Este contacto no ha dado permiso para recibir WhatsApp. Marca su consentimiento en la ficha del contacto si te lo dio.';
  ELSIF v_ch.paused_at IS NOT NULL THEN
    v_hard := true; v_reason := 'channel_paused'; v_msg := COALESCE('Envíos pausados: ' || v_ch.pause_reason, 'Los envíos de este número están pausados para protegerlo.');
  ELSIF v_tot >= 10 AND v_fail::numeric / v_tot >= 0.3 THEN
    v_hard := true; v_reason := 'failure_brake'; v_msg := 'Demasiados mensajes fallaron en las últimas 24 h. Se frenaron los envíos para proteger el número.';
  ELSIF v_ch.connected_at IS NOT NULL AND v_ch.connected_at > now() - interval '7 days' AND v_today >= 50 THEN
    v_hard := true; v_reason := 'ramp_up'; v_next := date_trunc('day', now()) + interval '1 day';
    v_msg := 'Número nuevo: durante su primera semana se permiten 50 plantillas al día para que Meta le dé buena reputación.';
  END IF;
  IF v_hard THEN
    RETURN jsonb_build_object('allowed', false, 'hard', true, 'window_open', false, 'reason', v_reason, 'message', v_msg, 'next_at', v_next, 'is_manager', v_mgr, 'opted_out', v_reason = 'opted_out');
  END IF;

  SELECT count(*), max(m.created_at) INTO v_attempts, v_last_try FROM messages m JOIN conversations c ON c.id = m.conversation_id
   WHERE c.tenant_id = _tenant_id AND c.contact_id = _contact_id AND m.direction = 'outbound'
     AND m.metadata->>'kind' = 'template' AND COALESCE(m.metadata->>'provider_error','') = ''
     AND m.created_at > COALESCE(v_last_in, '-infinity'::timestamptz)
     AND (v_bot OR COALESCE(m.metadata->>'bot','false') <> 'true');

  cf := v_ct.custom_fields;
  IF cf ? '_wa_extra' AND COALESCE(cf->'_wa_extra'->>'after','') = COALESCE(v_last_in::text,'') THEN
    v_extra := LEAST(COALESCE((cf->'_wa_extra'->>'n')::int, 0), 2);
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
    'allowed', v_reason IS NULL OR (v_mgr AND v_reason <> 'lead_max'),
    'window_open', false, 'hard', false,
    'reason', v_reason, 'message', v_msg, 'next_at', v_next,
    'attempt', v_attempts + 1, 'max', v_max + v_extra,
    'is_manager', v_mgr, 'bypass', v_reason IS NOT NULL AND v_mgr AND v_reason <> 'lead_max',
    'monthly_used', v_used, 'monthly_cap', v_cap
  );
END $function$;