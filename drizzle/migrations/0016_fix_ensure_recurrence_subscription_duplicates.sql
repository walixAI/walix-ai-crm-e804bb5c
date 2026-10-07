CREATE OR REPLACE FUNCTION public.ensure_recurrence_subscription(_deal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal record;
  v_cat record;
  v_period int;
  v_rec record;
  v_sub record;
BEGIN
  SELECT id, tenant_id, contact_id, product_category_id, service_frequency_months
    INTO v_deal FROM public.deals WHERE id = _deal_id;
  IF NOT FOUND OR v_deal.contact_id IS NULL OR v_deal.product_category_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_cat FROM public.product_categories WHERE id = v_deal.product_category_id;
  IF NOT FOUND OR NOT v_cat.is_recurring THEN RETURN NULL; END IF;

  v_period := COALESCE(v_deal.service_frequency_months, v_cat.default_period_months);
  IF v_period IS NULL OR v_period <= 0 THEN RETURN NULL; END IF;

  SELECT * INTO v_rec FROM public.recurrence_definitions
   WHERE tenant_id = v_deal.tenant_id
     AND product_category_id = v_cat.id
     AND enabled
     AND period_months = v_period
   ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Reutilizar la suscripción existente del contacto para esta categoría.
  -- Usar FOUND: un record con alguna columna NULL nunca evalúa IS NOT NULL
  -- (esto causaba suscripciones duplicadas en cada oportunidad nueva).
  SELECT s.* INTO v_sub
    FROM public.recurrence_subscriptions s
    JOIN public.recurrence_definitions d ON d.id = s.recurrence_id
   WHERE s.tenant_id = v_deal.tenant_id
     AND s.contact_id = v_deal.contact_id
     AND d.product_category_id = v_cat.id
   ORDER BY (s.status = 'active') DESC, s.created_at
   LIMIT 1;

  IF FOUND THEN
    IF v_sub.recurrence_id <> v_rec.id THEN
      UPDATE public.recurrence_subscriptions
         SET recurrence_id = v_rec.id, updated_at = now()
       WHERE id = v_sub.id;
      UPDATE public.recurrence_occurrences
         SET recurrence_id = v_rec.id, updated_at = now()
       WHERE subscription_id = v_sub.id AND status IN ('pending','notified','scheduled');
    END IF;
    RETURN v_sub.id;
  END IF;

  INSERT INTO public.recurrence_subscriptions (
    tenant_id, recurrence_id, contact_id, entity_type, entity_id, next_due_date, status, metadata
  ) VALUES (
    v_deal.tenant_id, v_rec.id, v_deal.contact_id, 'contact', v_deal.contact_id,
    date_trunc('month', CURRENT_DATE + make_interval(months => v_period))::date,
    'active', jsonb_build_object('created_from_deal', _deal_id)
  )
  RETURNING * INTO v_sub;

  RETURN v_sub.id;
END;
$function$;