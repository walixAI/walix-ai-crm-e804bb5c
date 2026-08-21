DROP POLICY IF EXISTS "exp_update_own_or_admin" ON public.expenses;
CREATE POLICY "exp_update_own_or_admin" ON public.expenses
FOR UPDATE
USING (
  (tenant_id = get_user_tenant(auth.uid()))
  AND ((owner_id = auth.uid()) OR has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
)
WITH CHECK (
  (tenant_id = get_user_tenant(auth.uid()))
  AND ((owner_id = auth.uid()) OR has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
);

DROP POLICY IF EXISTS "admin update wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin update wa channels" ON public.whatsapp_channels
FOR UPDATE
USING (
  is_platform(auth.uid())
  OR has_tenant_role(auth.uid(), 'tenant_admin'::app_role, tenant_id)
  OR has_tenant_role(auth.uid(), 'tenant_owner'::app_role, tenant_id)
)
WITH CHECK (
  is_platform(auth.uid())
  OR (
    (has_tenant_role(auth.uid(), 'tenant_admin'::app_role, tenant_id)
     OR has_tenant_role(auth.uid(), 'tenant_owner'::app_role, tenant_id))
    AND is_platform = false
  )
);

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, extensions;