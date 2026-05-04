
ALTER TABLE public.whatsapp_channels ADD COLUMN access_token text;
-- Tighten SELECT: only admin/owner of tenant (or platform) can read channel rows (token included).
DROP POLICY "tenant select wa channels" ON public.whatsapp_channels;
CREATE POLICY "admin select wa channels" ON public.whatsapp_channels FOR SELECT
  USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
