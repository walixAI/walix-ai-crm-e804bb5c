-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;

-- Tighten tenants insert: only authenticated user creating their own (no row tied to user yet, but require auth)
DROP POLICY IF EXISTS "Authenticated create tenant" ON public.tenants;
CREATE POLICY "Authenticated create tenant" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);