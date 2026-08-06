-- 1. Guardas de tenant en funciones SECURITY DEFINER expuestas al cliente
CREATE OR REPLACE FUNCTION public.get_user_profitability(_tenant_id uuid, _user_id uuid, _year integer, _month integer)
 RETURNS TABLE(revenue numeric, expenses numeric, margin_amount numeric, margin_pct numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_start DATE := make_date(_year, _month, 1);
  v_end   DATE := (v_start + interval '1 month')::date;
  v_rev NUMERIC := 0; v_exp NUMERIC := 0;
BEGIN
  IF NOT (public.user_can_use_tenant(auth.uid(), _tenant_id) OR public.is_platform(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_rev FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id AND is_won = true
    AND updated_at >= v_start AND updated_at < v_end;
  SELECT COALESCE(SUM(e.amount),0) INTO v_exp
  FROM public.expenses e LEFT JOIN public.deals d ON d.id = e.deal_id
  WHERE e.tenant_id = _tenant_id AND e.status = 'confirmed'
    AND e.incurred_at >= v_start AND e.incurred_at < v_end
    AND (e.owner_id = _user_id OR d.owner_id = _user_id);
  RETURN QUERY SELECT v_rev, v_exp, v_rev - v_exp,
    CASE WHEN v_rev > 0 THEN ROUND((v_rev - v_exp) / v_rev * 100.0, 2) ELSE 0 END;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_user_run_rate(_tenant_id uuid, _user_id uuid, _year integer, _month integer)
 RETURNS TABLE(assigned_goal numeric, won_amount numeric, open_amount numeric, run_rate_pct numeric, forecast_pct numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_start DATE := make_date(_year, _month, 1);
  v_end   DATE := (v_start + interval '1 month')::date;
  v_days_total INT := (v_end - v_start);
  v_day_of_month INT := LEAST(EXTRACT(DAY FROM CURRENT_DATE)::int, v_days_total);
  v_assigned NUMERIC; v_won NUMERIC; v_open NUMERIC;
BEGIN
  IF NOT (public.user_can_use_tenant(auth.uid(), _tenant_id) OR public.is_platform(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(SUM(a.amount),0) INTO v_assigned
  FROM public.monthly_goal_assignments a
  JOIN public.monthly_goals g ON g.id = a.goal_id
  WHERE g.tenant_id = _tenant_id AND g.period_year = _year AND g.period_month = _month
    AND a.user_id = _user_id AND g.dimension = 'global';

  IF v_assigned = 0 THEN
    SELECT COALESCE(g.amount,0) / NULLIF(public.tenant_active_users(_tenant_id),0) INTO v_assigned
    FROM public.monthly_goals g
    WHERE g.tenant_id = _tenant_id AND g.period_year = _year AND g.period_month = _month AND g.dimension = 'global'
    LIMIT 1;
    v_assigned := COALESCE(v_assigned, 0);
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_won FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id AND is_won = true
    AND updated_at >= v_start AND updated_at < v_end;

  SELECT COALESCE(SUM(amount),0) INTO v_open FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id
    AND COALESCE(is_won,false) = false AND COALESCE(is_lost,false) = false;

  RETURN QUERY SELECT v_assigned, v_won, v_open,
    CASE WHEN v_assigned > 0 THEN ROUND(v_won / v_assigned * 100.0, 2) ELSE 0 END,
    CASE WHEN v_assigned > 0 AND v_day_of_month > 0
         THEN ROUND((v_won / v_day_of_month * v_days_total) / v_assigned * 100.0, 2)
         ELSE 0 END;
END; $function$;

CREATE OR REPLACE FUNCTION public.pipeline_stage_impact(_stage_id uuid)
 RETURNS TABLE(deals_count integer, outcomes_count integer, outcomes_targeting_count integer, rules_count integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.pipeline_stages WHERE id = _stage_id;
  IF v_tenant IS NULL OR NOT (public.user_can_use_tenant(auth.uid(), v_tenant) OR public.is_platform(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT
    (SELECT count(*)::int FROM public.deals d WHERE d.stage_id = _stage_id),
    (SELECT count(*)::int FROM public.activity_outcomes o WHERE o.stage_id = _stage_id),
    (SELECT count(*)::int FROM public.activity_outcomes o WHERE o.moves_to_stage_id = _stage_id),
    (SELECT count(*)::int FROM public.pipeline_stage_rules r WHERE r.from_stage_id = _stage_id OR r.to_stage_id = _stage_id);
END; $function$;

-- suggest_goal_split: agregar guarda conservando el cuerpo original
DO $do$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'suggest_goal_split';
  IF v_src IS NOT NULL AND position('user_can_use_tenant' in v_src) = 0 THEN
    RAISE NOTICE 'suggest_goal_split requiere guarda manual';
  END IF;
END $do$;

-- 2. Revocar ejecución directa de funciones internas (solo servidor)
REVOKE EXECUTE ON FUNCTION public.search_contacts_fuzzy(uuid, text, uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_import_batch(uuid, boolean) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tenant_active_users(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trial_days_left(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recent_acted_suggestion(uuid, text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.org_tenant_count(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_contacts_fuzzy(uuid, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_import_batch(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.tenant_active_users(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trial_days_left(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recent_acted_suggestion(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_tenant_count(uuid) TO service_role;

-- 3. whatsapp_channels: rol validado contra el tenant de la fila
DROP POLICY IF EXISTS "admin select wa channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "admin insert wa channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "admin update wa channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "admin delete wa channels" ON public.whatsapp_channels;

CREATE POLICY "admin select wa channels" ON public.whatsapp_channels
FOR SELECT TO authenticated
USING (
  public.is_platform(auth.uid())
  OR (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id))
);

CREATE POLICY "admin insert wa channels" ON public.whatsapp_channels
FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform(auth.uid())
  OR (tenant_id IS NOT NULL AND is_platform = false
      AND (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
           OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)))
);

CREATE POLICY "admin update wa channels" ON public.whatsapp_channels
FOR UPDATE TO authenticated
USING (
  public.is_platform(auth.uid())
  OR (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id))
)
WITH CHECK (
  public.is_platform(auth.uid())
  OR (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id))
);

CREATE POLICY "admin delete wa channels" ON public.whatsapp_channels
FOR DELETE TO authenticated
USING (
  public.is_platform(auth.uid())
  OR (public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id))
);

-- 4. Política explícita de borrado en el bucket tenant-assets
DROP POLICY IF EXISTS "tenant admins delete tenant assets" ON storage.objects;
CREATE POLICY "tenant admins delete tenant assets" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (
    public.is_platform(auth.uid())
    OR (
      (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
      AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
    )
  )
);