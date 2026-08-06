CREATE OR REPLACE FUNCTION public.user_can_use_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _tenant_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.tenant_id = _tenant_id)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.tenant_id = _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = _tenant_id AND om.user_id = _user_id
    )
    OR public.is_platform(_user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_use_tenant(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND public.user_can_use_tenant(auth.uid(), active_tenant_id)
  AND public.user_can_use_tenant(auth.uid(), tenant_id)
);