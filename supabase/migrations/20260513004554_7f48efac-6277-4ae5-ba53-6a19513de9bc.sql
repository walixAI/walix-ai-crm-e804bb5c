-- Allow members of the same tenant to read each other's basic profile and roles
DROP POLICY IF EXISTS "Tenant members view tenant profiles" ON public.profiles;
CREATE POLICY "Tenant members view tenant profiles"
ON public.profiles
FOR SELECT
USING (
  tenant_id IS NOT NULL
  AND tenant_id = public.get_user_tenant(auth.uid())
);

DROP POLICY IF EXISTS "Tenant members view tenant roles" ON public.user_roles;
CREATE POLICY "Tenant members view tenant roles"
ON public.user_roles
FOR SELECT
USING (
  tenant_id IS NOT NULL
  AND tenant_id = public.get_user_tenant(auth.uid())
);