-- 1. Horizonte configurable por recurrencia
ALTER TABLE public.recurrence_definitions
  ADD COLUMN IF NOT EXISTS future_horizon integer NOT NULL DEFAULT 2;

-- 2. Evitar duplicados de ocurrencias por suscripción/mes
CREATE UNIQUE INDEX IF NOT EXISTS recurrence_occurrences_sub_due_uidx
  ON public.recurrence_occurrences (subscription_id, due_date);

CREATE INDEX IF NOT EXISTS recurrence_occurrences_tenant_due_status_idx
  ON public.recurrence_occurrences (tenant_id, due_date, status);

CREATE INDEX IF NOT EXISTS recurrence_occurrences_deal_idx
  ON public.recurrence_occurrences (generated_deal_id);

-- 3. Rellenar la agenda futura de una suscripción hasta el horizonte configurado
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

  -- Punto de partida: última ocurrencia conocida o el ciclo pendiente
  IF v_last IS NULL THEN
    SELECT max(due_date) INTO v_last
      FROM public.recurrence_occurrences WHERE subscription_id = v_sub.id;
  END IF;
  IF v_last IS NULL THEN
    v_last := date_trunc('month', COALESCE(v_sub.next_due_date, CURRENT_DATE))::date;
    IF v_last > CURRENT_DATE THEN
      v_future := v_future; -- se insertará abajo
      v_last := (v_last - make_interval(months => v_period))::date;
    END IF;
  END IF;

  WHILE v_future < v_horizon LOOP
    v_next := date_trunc('month', (v_last + make_interval(months => v_period)))::date;
    -- Nunca programar en el pasado
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

  -- La próxima fecha de la suscripción es la ocurrencia futura más cercana
  UPDATE public.recurrence_subscriptions s
     SET next_due_date = COALESCE((
           SELECT min(due_date) FROM public.recurrence_occurrences o
            WHERE o.subscription_id = s.id
              AND o.due_date > CURRENT_DATE
              AND o.status NOT IN ('skipped','executed')
         ), s.next_due_date),
         updated_at = now()
   WHERE s.id = v_sub.id;

  RETURN v_created;
END;
$$;

-- 4. Cerrar el ciclo cuando la oportunidad se gana o se pierde
CREATE OR REPLACE FUNCTION public.close_recurrence_from_deal(_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_occ record;
  v_created int := 0;
BEGIN
  SELECT id, tenant_id, amount, is_won, is_lost INTO v_deal
    FROM public.deals WHERE id = _deal_id;
  IF v_deal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deal_not_found');
  END IF;

  SELECT * INTO v_occ FROM public.recurrence_occurrences
   WHERE generated_deal_id = _deal_id
   ORDER BY due_date DESC LIMIT 1;
  IF v_occ IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_recurrent');
  END IF;

  IF COALESCE(v_deal.is_won, false) THEN
    UPDATE public.recurrence_occurrences
       SET status = 'executed',
           executed_at = COALESCE(executed_at, now()),
           price_quoted = COALESCE(price_quoted, v_deal.amount),
           updated_at = now()
     WHERE id = v_occ.id;

    IF v_occ.generated_task_id IS NOT NULL THEN
      UPDATE public.tasks SET completed = true, completed_at = now()
       WHERE id = v_occ.generated_task_id AND completed = false;
    END IF;

    UPDATE public.recurrence_subscriptions
       SET last_executed_date = v_occ.due_date, updated_at = now()
     WHERE id = v_occ.subscription_id;

    v_created := public.recurrence_fill_horizon(v_occ.subscription_id);

  ELSIF COALESCE(v_deal.is_lost, false) THEN
    UPDATE public.recurrence_occurrences
       SET status = 'skipped', updated_at = now()
     WHERE id = v_occ.id;
    IF v_occ.generated_task_id IS NOT NULL THEN
      UPDATE public.tasks SET completed = true, completed_at = now()
       WHERE id = v_occ.generated_task_id AND completed = false;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'deal_open');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence_id', v_occ.id,
    'subscription_id', v_occ.subscription_id,
    'scheduled', v_created,
    'next_dates', COALESCE((
      SELECT jsonb_agg(due_date ORDER BY due_date)
        FROM public.recurrence_occurrences
       WHERE subscription_id = v_occ.subscription_id
         AND due_date > CURRENT_DATE
         AND status NOT IN ('skipped')
    ), '[]'::jsonb)
  );
END;
$$;

-- 5. Trigger: al ganar o perder la oportunidad
CREATE OR REPLACE FUNCTION public.trg_close_recurrence_on_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_won IS DISTINCT FROM OLD.is_won AND COALESCE(NEW.is_won,false))
     OR (NEW.is_lost IS DISTINCT FROM OLD.is_lost AND COALESCE(NEW.is_lost,false)) THEN
    BEGIN
      PERFORM public.close_recurrence_from_deal(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'close_recurrence_from_deal failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_close_recurrence ON public.deals;
CREATE TRIGGER trg_deals_close_recurrence
AFTER UPDATE OF is_won, is_lost ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_close_recurrence_on_deal();

-- 6. Permisos
REVOKE ALL ON FUNCTION public.recurrence_fill_horizon(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_recurrence_from_deal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recurrence_fill_horizon(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_recurrence_from_deal(uuid) TO authenticated, service_role;

-- 7. Campos personalizados de periodicidad para tenants con recurrencias
INSERT INTO public.contact_custom_fields (tenant_id, key, label, field_type, position, is_active, show_in_list)
SELECT DISTINCT r.tenant_id, 'periodo_recurrencia_mantenimiento',
       'Periodo de recurrencia mantenimiento', 'text', 10, true, false
  FROM public.recurrence_definitions r
 WHERE NOT EXISTS (
   SELECT 1 FROM public.contact_custom_fields f
    WHERE f.tenant_id = r.tenant_id AND f.key = 'periodo_recurrencia_mantenimiento'
 );

INSERT INTO public.contact_custom_fields (tenant_id, key, label, field_type, position, is_active, show_in_list)
SELECT DISTINCT r.tenant_id, 'periodo_recurrencia_filtro',
       'Periodo de recurrencia cambio filtro', 'text', 11, true, false
  FROM public.recurrence_definitions r
 WHERE NOT EXISTS (
   SELECT 1 FROM public.contact_custom_fields f
    WHERE f.tenant_id = r.tenant_id AND f.key = 'periodo_recurrencia_filtro'
 );