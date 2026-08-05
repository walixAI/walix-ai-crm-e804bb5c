GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;

DROP POLICY IF EXISTS "users read own ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "users read own ai_usage_log"
ON public.ai_usage_log FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()) AND user_id = auth.uid());