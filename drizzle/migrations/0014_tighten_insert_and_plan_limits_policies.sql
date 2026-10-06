DROP POLICY IF EXISTS "Authenticated create tenant" ON public.tenants;
CREATE POLICY "Org owners create tenant in own org" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (
  (organization_id IS NOT NULL AND public.is_org_owner(auth.uid(), organization_id))
  OR public.is_platform(auth.uid())
);

DROP POLICY IF EXISTS "authenticated creates org" ON public.organizations;
CREATE POLICY "users create own org" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.is_platform(auth.uid()));

DROP POLICY IF EXISTS "read org_plan_limits" ON public.org_plan_limits;
CREATE POLICY "read own org plan limits" ON public.org_plan_limits
FOR SELECT TO authenticated
USING (
  public.is_platform(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.organization_members m ON m.organization_id = o.id
    WHERE m.user_id = auth.uid() AND o.plan = org_plan_limits.plan
  )
);