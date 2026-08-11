-- 1. Categorías recurrentes
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_period_months smallint;

ALTER TABLE public.recurrence_definitions
  ADD COLUMN IF NOT EXISTS product_category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- 2. Estado de suscripción
ALTER TABLE public.recurrence_subscriptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

DO $$ BEGIN
  ALTER TABLE public.recurrence_subscriptions
    ADD CONSTRAINT recurrence_subscriptions_status_check
    CHECK (status IN ('active','paused','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Estado 'lost' en ocurrencias
ALTER TABLE public.recurrence_occurrences DROP CONSTRAINT IF EXISTS recurrence_occurrences_status_check;
ALTER TABLE public.recurrence_occurrences ADD CONSTRAINT recurrence_occurrences_status_check
  CHECK (status = ANY (ARRAY['pending','notified','completed','skipped','price_accepted','scheduled','executed','postponed','historic','lost']));

-- 4. Backfill: ligar recurrencias existentes a su categoría y marcar categorías recurrentes
UPDATE public.recurrence_definitions r
   SET product_category_id = c.id
  FROM public.product_categories c
 WHERE c.tenant_id = r.tenant_id
   AND r.product_category_id IS NULL
   AND c.is_active
   AND (
        (r.name ILIKE 'mantenimiento%' AND c.name ILIKE 'mantenimiento%')
     OR (r.name ILIKE 'cambio de filtro%' AND c.name ILIKE 'cambio de filtro%')
   );

UPDATE public.product_categories c
   SET is_recurring = true,
       default_period_months = COALESCE(default_period_months, (
         SELECT min(r.period_months) FROM public.recurrence_definitions r
          WHERE r.product_category_id = c.id AND r.enabled
       ))
 WHERE EXISTS (SELECT 1 FROM public.recurrence_definitions r WHERE r.product_category_id = c.id AND r.enabled);

-- 5. Fill horizon respeta el estado de la suscripción
CREATE OR REPLACE FUNCTION public.recurrence_fill_horizon(_subscription_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_rec record;
  v_owner uuid;
  v_period int;
  v_horizon int;
  v_future int;
  v_last date;
  v_next date;
  v_created int := 0;
BEGIN
  SELECT * INTO v_sub FROM public.recurrence_subscriptions WHERE id = _subscription_id;
  IF v_sub IS NULL THEN RETURN 0; END IF;
  IF COALESCE(v_sub.status, 'active') <> 'active' THEN RETURN 0; END IF;

  SELECT * INTO v_rec FROM public.recurrence_definitions WHERE id = v_sub.recurrence_id;
  IF v_rec IS NULL OR NOT v_rec.enabled THEN RETURN 0; END IF;

  v_period := COALESCE(v_rec.period_months, CASE WHEN v_rec.kind = 'calendar' THEN 12 ELSE 6 END);
  IF v_period <= 0 THEN RETURN 0; END IF;
  v_horizon := GREATEST(COALESCE(v_rec.future_horizon, 2), 0);

  SELECT owner_id INTO v_owner FROM public.contacts WHERE id = v_sub.contact_id;

  SELECT count(*)::int, max(due_date)
    INTO v_future, v_last
    FROM public.recurrence_occurrences
   WHERE subscription_id = v_sub.id
     AND due_date > CURRENT_DATE
     AND status NOT IN ('skipped');

  IF v_last IS NULL THEN
    SELECT max(due_date) INTO v_last
      FROM public.recurrence_occurrences WHERE subscription_id = v_sub.id;
  END IF;
  IF v_last IS NULL THEN
    v_last := date_trunc('month', COALESCE(v_sub.next_due_date, CURRENT_DATE))::date;
    IF v_last > CURRENT_DATE THEN
      v_last := (v_last - make_interval(months => v_period))::date;
    END IF;
  END IF;

  WHILE v_future < v_horizon LOOP
    v_next := date_trunc('month', (v_last + make_interval(months => v_period)))::date;
    WHILE v_next <= CURRENT_DATE LOOP
      v_next := date_trunc('month', (v_next + make_interval(months => v_period)))::date;
    END LOOP;

    INSERT INTO public.recurrence_occurrences (
      tenant_id, recurrence_id, subscription_id, due_date, status, assigned_to
    ) VALUES (
      v_sub.tenant_id, v_sub.recurrence_id, v_sub.id, v_next, 'pending', v_owner
    )
    ON CONFLICT (subscription_id, due_date) DO NOTHING;

    v_last := v_next;
    v_future := v_future + 1;
    v_created := v_created + 1;
  END LOOP;

  UPDATE public.recurrence_subscriptions s
     SET next_due_date = COALESCE((
           SELECT min(due_date) FROM public.recurrence_occurrences o
            WHERE o.subscription_id = s.id
              AND o.due_date > CURRENT_DATE
              AND o.status NOT IN ('skipped','executed','lost')
         ), s.next_due_date),
         updated_at = now()
   WHERE s.id = v_sub.id;

  RETURN v_created;
END;
$$;

-- 6. Alta automática de suscripción desde una oportunidad
CREATE OR REPLACE FUNCTION public.ensure_recurrence_subscription(_deal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_cat record;
  v_period int;
  v_rec record;
  v_sub record;
BEGIN
  SELECT id, tenant_id, contact_id, product_category_id, service_frequency_months
    INTO v_deal FROM public.deals WHERE id = _deal_id;
  IF v_deal IS NULL OR v_deal.contact_id IS NULL OR v_deal.product_category_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_cat FROM public.product_categories WHERE id = v_deal.product_category_id;
  IF v_cat IS NULL OR NOT v_cat.is_recurring THEN RETURN NULL; END IF;

  v_period := COALESCE(v_deal.service_frequency_months, v_cat.default_period_months);
  IF v_period IS NULL OR v_period <= 0 THEN RETURN NULL; END IF;

  SELECT * INTO v_rec FROM public.recurrence_definitions
   WHERE tenant_id = v_deal.tenant_id
     AND product_category_id = v_cat.id
     AND enabled
     AND period_months = v_period
   ORDER BY created_at LIMIT 1;
  IF v_rec IS NULL THEN RETURN NULL; END IF;

  -- ¿Ya hay suscripción de este contacto para alguna recurrencia de esta categoría?
  SELECT s.* INTO v_sub
    FROM public.recurrence_subscriptions s
    JOIN public.recurrence_definitions d ON d.id = s.recurrence_id
   WHERE s.tenant_id = v_deal.tenant_id
     AND s.contact_id = v_deal.contact_id
     AND d.product_category_id = v_cat.id
   ORDER BY (s.status = 'active') DESC, s.created_at
   LIMIT 1;

  IF v_sub IS NOT NULL THEN
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
$$;

CREATE OR REPLACE FUNCTION public.trg_deal_ensure_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_recurrence_subscription(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_ensure_subscription ON public.deals;
CREATE TRIGGER deals_ensure_subscription
AFTER INSERT OR UPDATE OF product_category_id, service_frequency_months ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_deal_ensure_subscription();

-- 7. Cierre del ciclo: ganar crea los siguientes leads, perder continúa la recurrencia
CREATE OR REPLACE FUNCTION public.close_recurrence_from_deal(_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_occ record;
  v_sub_id uuid;
  v_period int;
  v_created int := 0;
BEGIN
  SELECT id, tenant_id, amount, is_won, is_lost, contact_id, owner_id, service_frequency_months
    INTO v_deal FROM public.deals WHERE id = _deal_id;
  IF v_deal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deal_not_found');
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (public.user_can_use_tenant(auth.uid(), v_deal.tenant_id) OR public.is_platform(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT (COALESCE(v_deal.is_won, false) OR COALESCE(v_deal.is_lost, false)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deal_open');
  END IF;

  SELECT * INTO v_occ FROM public.recurrence_occurrences
   WHERE generated_deal_id = _deal_id
   ORDER BY due_date DESC LIMIT 1;

  -- Lead manual: crear suscripción y su ocurrencia del ciclo actual
  IF v_occ IS NULL THEN
    v_sub_id := public.ensure_recurrence_subscription(_deal_id);
    IF v_sub_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_recurrent');
    END IF;

    INSERT INTO public.recurrence_occurrences (
      tenant_id, recurrence_id, subscription_id, due_date, status, assigned_to, generated_deal_id
    )
    SELECT s.tenant_id, s.recurrence_id, s.id,
           date_trunc('month', CURRENT_DATE)::date, 'pending', v_deal.owner_id, _deal_id
      FROM public.recurrence_subscriptions s WHERE s.id = v_sub_id
    ON CONFLICT (subscription_id, due_date) DO UPDATE SET generated_deal_id = EXCLUDED.generated_deal_id;

    SELECT * INTO v_occ FROM public.recurrence_occurrences
     WHERE subscription_id = v_sub_id AND due_date = date_trunc('month', CURRENT_DATE)::date;
  END IF;

  IF COALESCE(v_deal.is_won, false) THEN
    UPDATE public.recurrence_occurrences
       SET status = 'executed',
           executed_at = COALESCE(executed_at, now()),
           price_quoted = COALESCE(price_quoted, v_deal.amount),
           updated_at = now()
     WHERE id = v_occ.id;

    UPDATE public.recurrence_subscriptions
       SET last_executed_date = v_occ.due_date, updated_at = now()
     WHERE id = v_occ.subscription_id;
  ELSE
    UPDATE public.recurrence_occurrences
       SET status = 'lost', updated_at = now()
     WHERE id = v_occ.id;
  END IF;

  IF v_occ.generated_task_id IS NOT NULL THEN
    UPDATE public.tasks SET completed = true, completed_at = now()
     WHERE id = v_occ.generated_task_id AND completed = false;
  END IF;

  -- La recurrencia continúa mientras la suscripción esté activa (ganada o perdida)
  v_created := public.recurrence_fill_horizon(v_occ.subscription_id);

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence_id', v_occ.id,
    'subscription_id', v_occ.subscription_id,
    'outcome', CASE WHEN COALESCE(v_deal.is_won,false) THEN 'won' ELSE 'lost' END,
    'scheduled', v_created,
    'next_dates', COALESCE((
      SELECT jsonb_agg(due_date ORDER BY due_date)
        FROM public.recurrence_occurrences
       WHERE subscription_id = v_occ.subscription_id
         AND due_date > CURRENT_DATE
         AND status NOT IN ('skipped','lost')
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_deal_close_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (COALESCE(NEW.is_won,false) AND NOT COALESCE(OLD.is_won,false))
     OR (COALESCE(NEW.is_lost,false) AND NOT COALESCE(OLD.is_lost,false)) THEN
    PERFORM public.close_recurrence_from_deal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_close_recurrence ON public.deals;
CREATE TRIGGER deals_close_recurrence
AFTER UPDATE OF is_won, is_lost ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_deal_close_recurrence();