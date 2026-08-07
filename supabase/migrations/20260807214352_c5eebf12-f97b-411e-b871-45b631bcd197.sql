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

  IF auth.uid() IS NOT NULL
     AND NOT (public.user_can_use_tenant(auth.uid(), v_deal.tenant_id) OR public.is_platform(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
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

REVOKE ALL ON FUNCTION public.close_recurrence_from_deal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_recurrence_from_deal(uuid) TO authenticated, service_role;