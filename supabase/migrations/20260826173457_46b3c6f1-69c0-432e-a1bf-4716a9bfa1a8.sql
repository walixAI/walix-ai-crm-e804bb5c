DROP POLICY "exp_update_own_or_admin" ON public.expenses;
CREATE POLICY "exp_update_own_or_admin" ON public.expenses
FOR UPDATE TO authenticated
USING ((tenant_id = get_user_tenant(auth.uid())) AND ((owner_id = auth.uid()) OR has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role)))
WITH CHECK ((tenant_id = get_user_tenant(auth.uid())) AND ((owner_id = auth.uid()) OR has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role)));

DROP POLICY "admin update wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin update wa channels" ON public.whatsapp_channels
FOR UPDATE TO authenticated
USING (is_platform(auth.uid()) OR has_tenant_role(auth.uid(), 'tenant_admin'::app_role, tenant_id) OR has_tenant_role(auth.uid(), 'tenant_owner'::app_role, tenant_id))
WITH CHECK (is_platform(auth.uid()) OR ((has_tenant_role(auth.uid(), 'tenant_admin'::app_role, tenant_id) OR has_tenant_role(auth.uid(), 'tenant_owner'::app_role, tenant_id)) AND (is_platform = false)));

DROP POLICY "tenant member inserts notifications" ON public.notifications;
CREATE POLICY "tenant member inserts notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  is_platform(auth.uid())
  OR (
    tenant_id = get_user_tenant(auth.uid())
    AND (
      user_id = auth.uid()
      OR user_id IS NULL
      OR has_role(auth.uid(), 'tenant_admin'::app_role)
      OR has_role(auth.uid(), 'tenant_owner'::app_role)
    )
  )
);