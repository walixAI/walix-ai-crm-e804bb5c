
-- 1. search_path fijo en funciones de cola de correo
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';

-- 2. Revocar EXECUTE de anon/authenticated en TODAS las funciones SECURITY DEFINER de public
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- 2b. Re-otorgar solo las funciones que la app realmente llama
GRANT EXECUTE ON FUNCTION public.get_invitation_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_pipeline_stage(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_stage_impact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_contacts_fuzzy(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profitability(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_run_rate(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_goal_split(uuid, text, text, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_activity_outcomes(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_deal_diagnostics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_pipeline_template(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_recompute_next_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_import_batch(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_use_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trial_days_left(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_active_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_tenant_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recent_acted_suggestion(uuid, text, uuid) TO authenticated;

-- 3. Políticas con rol 'public' -> 'authenticated' (excepto las de service_role)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND coalesce(qual, '') || coalesce(with_check, '') NOT ILIKE '%service_role%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 4. pipeline_stage_rules: usar get_user_tenant validado
DROP POLICY IF EXISTS "Users can manage rules in their tenant" ON public.pipeline_stage_rules;
CREATE POLICY "psr_select" ON public.pipeline_stage_rules FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.user_can_use_tenant(auth.uid(), tenant_id));
CREATE POLICY "psr_write" ON public.pipeline_stage_rules FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.user_can_use_tenant(auth.uid(), tenant_id))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.user_can_use_tenant(auth.uid(), tenant_id));

-- 5. recurring_expenses: escritura solo para admins/owners del tenant
DROP POLICY IF EXISTS rec_exp_insert ON public.recurring_expenses;
DROP POLICY IF EXISTS rec_exp_update ON public.recurring_expenses;
DROP POLICY IF EXISTS rec_exp_delete ON public.recurring_expenses;
CREATE POLICY rec_exp_insert ON public.recurring_expenses FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (
    public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
    OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
    OR public.is_platform(auth.uid())));
CREATE POLICY rec_exp_update ON public.recurring_expenses FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (
    public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
    OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
    OR public.is_platform(auth.uid())));
CREATE POLICY rec_exp_delete ON public.recurring_expenses FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (
    public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
    OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
    OR public.is_platform(auth.uid())));
