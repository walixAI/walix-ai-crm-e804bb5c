CREATE OR REPLACE FUNCTION public.close_recurrence_from_deal(_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal record;
  v_occ record;
  v_sub_id uuid;
  v_created int := 0;
  v_next jsonb;
  v_next_date date;
  v_contact_name text;
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
    UPDATE public.tasks
       SET completed = true,
           closed_at = COALESCE(closed_at, now()),
           closed_via = COALESCE(closed_via, 'deal_close'),
           updated_at = now()
     WHERE id = v_occ.generated_task_id AND completed = false;
  END IF;

  v_created := public.recurrence_fill_horizon(v_occ.subscription_id);

  SELECT COALESCE(jsonb_agg(due_date ORDER BY due_date), '[]'::jsonb), MIN(due_date)
    INTO v_next, v_next_date
    FROM public.recurrence_occurrences
   WHERE subscription_id = v_occ.subscription_id
     AND due_date > CURRENT_DATE
     AND status NOT IN ('skipped','lost');

  -- Avisar al responsable que la recurrencia quedó agendada
  IF COALESCE(v_deal.is_won, false) AND v_next_date IS NOT NULL THEN
    SELECT name INTO v_contact_name FROM public.contacts WHERE id = v_deal.contact_id;
    INSERT INTO public.notifications (tenant_id, user_id, category, type, title, body, link, icon, severity, data)
    VALUES (
      v_deal.tenant_id,
      v_deal.owner_id,
      'operational',
      'recurrence_scheduled',
      'Servicio recurrente agendado',
      COALESCE(v_contact_name, 'El cliente') || ': próximo servicio en ' ||
        to_char(v_next_date, 'MM/YYYY') || '. Walix te avisará unos días antes con la oportunidad y la tarea.',
      CASE WHEN v_deal.contact_id IS NOT NULL THEN '/contactos/' || v_deal.contact_id::text ELSE '/automatizaciones' END,
      'RefreshCw',
      'success',
      jsonb_build_object('subscription_id', v_occ.subscription_id, 'next_dates', v_next, 'deal_id', _deal_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence_id', v_occ.id,
    'subscription_id', v_occ.subscription_id,
    'outcome', CASE WHEN COALESCE(v_deal.is_won,false) THEN 'won' ELSE 'lost' END,
    'scheduled', v_created,
    'next_dates', v_next
  );
END;
$function$;